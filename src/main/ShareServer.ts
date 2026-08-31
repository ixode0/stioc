import * as http from "http";
import * as crypto from "crypto";
import {WebSocketServer, WebSocket} from "ws";

type Share = {
    token: string;
    url: string;
    publicUrl?: string;
    tunnel?: any;
    createdAt: number;
    expiresAt: number;
    maxClients: number;
    readOnly: boolean;
    clients: Set<WebSocket>;
    onData?: (data: string) => void;
    onInput?: (data: string) => void;
    dispose?: { dispose(): void };
};

export class ShareServer {
    private httpServer?: http.Server;
    private wss?: WebSocketServer;
    private shares = new Map<string, Share>(); // token -> share
    private defaultTtlMs = 60 * 60 * 1000; // 1h

    private ensureServer(): http.Server {
        if (this.httpServer) return this.httpServer;
        this.httpServer = http.createServer((req, res) => {
            const url = new URL(req.url || "/", `http://${req.headers.host}`);
            if (url.pathname === "/ws") { res.writeHead(426); res.end(); return; }
            // CORS + security headers
            res.setHeader("X-Content-Type-Options", "nosniff");
            res.setHeader("X-Frame-Options", "DENY");
            res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'");
            res.setHeader("Access-Control-Allow-Origin", "null");
            if (url.pathname === "/health") { res.writeHead(200, {"Content-Type":"application/json"}); res.end(JSON.stringify({ok:true, shares:this.shares.size})); return; }
            // viewer requires token
            const token = url.searchParams.get("token") || "";
            const share = this.shares.get(token);
            if (!token || !share) {
                res.writeHead(401, {"Content-Type":"text/html"}); res.end("<h1>401 — invalid token</h1><p>Share link is per-session. Ask owner for new link.</p>"); return;
            }
            if (Date.now() > share.expiresAt) {
                res.writeHead(410, {"Content-Type":"text/html"}); res.end("<h1>410 — link expired</h1>"); return;
            }
            const ro = share.readOnly ? "(read-only)" : "(read-write)";
            const viewerHtml = `<!doctype html><html><head><meta charset="utf-8"><title>STIOC Share ${ro}</title>
<style>body{margin:0;background:#0f1115;color:#eee;font-family:monospace} #term{padding:10px;white-space:pre-wrap;word-break:break-all} h1{font-size:13px;padding:10px;margin:0;background:#1a1d24;border-bottom:1px solid #2a2f3a} #badge{float:right;opacity:.7}</style>
</head><body><h1>STIOC Shared Terminal ${ro} <span id="badge">${token.slice(0,8)}…</span></h1><div id="term"></div><script>
const params=new URLSearchParams(location.search); const token=params.get('token')||'';
const term=document.getElementById('term'); const proto=location.protocol==='https:'?'wss:':'ws:';
const ws=new WebSocket(proto+'//'+location.host+'/ws?token='+encodeURIComponent(token));
ws.onmessage=e=>{ term.textContent+=e.data; window.scrollTo(0,document.body.scrollHeight); };
ws.onopen=()=> term.textContent+='[connected ${ro}]\\n';
ws.onclose=e=> term.textContent+='\\n[disconnected '+(e.reason||e.code)+']\\n';
${share.readOnly ? "" : `document.addEventListener('keydown',e=>{
  if(ws.readyState!==1) return;
  if(e.key.length===1 && !e.ctrlKey && !e.metaKey) { ws.send(e.key); e.preventDefault(); }
  else if(e.key==='Enter') { ws.send('\\r'); e.preventDefault(); }
  else if(e.key==='Backspace') { ws.send('\\x7f'); e.preventDefault(); }
});`}
</script></body></html>`;
            res.writeHead(200, {"Content-Type":"text/html; charset=utf-8"});
            res.end(viewerHtml);
        });
        this.wss = new WebSocketServer({server: this.httpServer, path: "/ws"});
        this.wss.on("connection", (ws, req) => {
            const url = new URL(req.url || "/", `http://${req.headers.host}`);
            const token = url.searchParams.get("token") || "";
            const share = this.shares.get(token);
            if (!share || Date.now() > share.expiresAt) { ws.close(1008, "invalid token"); return; }
            if (share.clients.size >= share.maxClients) { ws.close(1013, "too many clients"); return; }
            // origin check
            const origin = (req.headers.origin || "") as string;
            if (origin && !origin.startsWith("http://localhost") && !origin.startsWith("http://127.0.0.1")) {
                // allow null/empty origin (direct open) but block foreign sites
                const ok = origin === "null" || origin === "";
                if (!ok) { ws.close(1008, "bad origin"); return; }
            }
            share.clients.add(ws);
            let msgCount = 0; let lastReset = Date.now();
            ws.on("message", (msg) => {
                if (share.readOnly) return;
                // rate limit: 30 msg/sec
                const now = Date.now();
                if (now - lastReset > 1000) { msgCount = 0; lastReset = now; }
                if (++msgCount > 30) return;
                const text = msg.toString().slice(0, 1024);
                try { share.onInput?.(text); } catch {}
            });
            ws.on("close", () => share.clients.delete(ws));
            ws.on("error", () => share.clients.delete(ws));
        });
        this.httpServer.listen(0, "127.0.0.1");
        return this.httpServer;
    }

    async start(broadcast: (listener: (data: string) => void) => { dispose(): void }, writeToPty: (data: string) => void, opts?: { readOnly?: boolean; ttlMs?: number; maxClients?: number }): Promise<{url:string, publicUrl?:string, token:string, expiresAt:number}> {
        const server = this.ensureServer();
        if (!server.listening) await new Promise<void>((r)=>server.once("listening", r));
        const token = crypto.randomBytes(16).toString("hex");
        const now = Date.now();
        const expiresAt = now + (opts?.ttlMs ?? this.defaultTtlMs);
        const share: Share = {
            token, url: "", createdAt: now, expiresAt,
            maxClients: opts?.maxClients ?? 5,
            readOnly: opts?.readOnly ?? false,
            clients: new Set(),
        };
        share.onInput = writeToPty;
        share.onData = (data: string) => {
            for (const c of share.clients) if (c.readyState === WebSocket.OPEN) c.send(data);
        };
        const disp = broadcast((data) => share.onData?.(data));
        share.dispose = disp;
        const addr = server.address() as any;
        const host = addr.address === "127.0.0.1" ? "localhost" : addr.address;
        const localUrl = `http://${host}:${addr.port}/?token=${token}`;
        share.url = localUrl;
        this.shares.set(token, share);
        // auto tunnel public URL (Upterm heritage updated 2026) — fallback to local if offline
        try {
            // @ts-ignore localtunnel has no types
            const lt = await import("localtunnel");
            const tunnel: any = await (lt as any).default({port: addr.port, local_host: "127.0.0.1"});
            // tunnel.url is https://xxx.loca.lt
            share.tunnel = tunnel;
            share.publicUrl = `${tunnel.url}/?token=${token}`;
            tunnel.on("close", () => { share.publicUrl = undefined; share.tunnel = undefined; });
            tunnel.on("error", () => { share.publicUrl = undefined; });
        } catch (e) {
            // no internet / lt fail -> keep local only
        }
        setTimeout(() => this.revoke(token).catch(()=>{}), expiresAt - now).unref?.();
        return {url: share.publicUrl || localUrl, token, expiresAt, publicUrl: share.publicUrl} as any;
    }

    broadcast(data: string, token?: string) {
        if (token) {
            const s = this.shares.get(token);
            if (!s) return;
            for (const c of s.clients) if (c.readyState === WebSocket.OPEN) c.send(data);
            return;
        }
        for (const s of this.shares.values()) for (const c of s.clients) if (c.readyState === WebSocket.OPEN) c.send(data);
    }

    async revoke(token: string): Promise<void> {
        const s = this.shares.get(token);
        if (!s) return;
        try { s.dispose?.dispose(); } catch {}
        for (const c of s.clients) try { c.close(1000, "revoked"); } catch {}
        s.clients.clear();
        try { s.tunnel?.close?.(); } catch {}
        s.tunnel = undefined; s.publicUrl = undefined;
        this.shares.delete(token);
        if (this.shares.size === 0) await this.stopIfIdle();
    }

    private async stopIfIdle(): Promise<void> {
        if (this.shares.size > 0) return;
        // keep server alive for reuse; do not close immediately to avoid port churn
    }

    getUrl(token?: string) {
        if (token) return this.shares.get(token)?.url;
        const first = this.shares.values().next().value as Share|undefined;
        return first?.url;
    }

    list() { return [...this.shares.values()].map(s=>({token:s.token.slice(0,8)+'…', url:s.publicUrl||s.url, localUrl:s.url, publicUrl:s.publicUrl, clients:s.clients.size, readOnly:s.readOnly, expiresAt:s.expiresAt})); }

    async stop(token?: string): Promise<void> {
        if (token) { await this.revoke(token); return; }
        for (const t of [...this.shares.keys()]) await this.revoke(t);
        await new Promise<void>((r)=> this.wss ? this.wss.close(()=>r()) : r());
        await new Promise<void>((r)=> this.httpServer ? this.httpServer.close(()=>r()) : r());
        this.wss = undefined; this.httpServer = undefined;
    }

    isRunning() { return this.shares.size > 0; }
    isRunningToken(token:string) { return this.shares.has(token); }
}

export const shareServer = new ShareServer();

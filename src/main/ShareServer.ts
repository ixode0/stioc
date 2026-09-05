import * as http from "http";
import * as crypto from "crypto";
import {WebSocketServer, WebSocket} from "ws";
import {VIEWER_CSS, VIEWER_JS} from "./shareViewerAssets";

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
    onInput?: (data: string, token: string) => void;
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
            // Viewer JS/CSS are external files (/viewer.js, /viewer.css), so
            // CSP stays strict with no 'unsafe-inline': script-src 'self' only.
            // No user data is interpolated into JS — read-only mode travels
            // via <body data-ro>, token stays in ?token= and is hex-only.
            // No ACAO header: viewer is same-origin, WS origin is checked per-share instead.
            res.setHeader("X-Content-Type-Options", "nosniff");
            res.setHeader("X-Frame-Options", "DENY");
            res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'");
            if (url.pathname === "/viewer.js") { res.writeHead(200, {"Content-Type":"application/javascript; charset=utf-8"}); res.end(VIEWER_JS); return; }
            if (url.pathname === "/viewer.css") { res.writeHead(200, {"Content-Type":"text/css; charset=utf-8"}); res.end(VIEWER_CSS); return; }
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
            const roBanner = share.readOnly
                ? `<div class="ro-banner">READ-ONLY share — your keystrokes are ignored. Ask the owner for a read-write link.</div>`
                : `<div class="rw-banner">READ-WRITE share — everything you type runs on the owner's machine.</div>`;
            const viewerHtml = `<!doctype html><html><head><meta charset="utf-8"><title>STIOC Share ${ro}</title>
<link rel="stylesheet" href="/viewer.css">
</head><body data-ro="${share.readOnly ? "1" : "0"}"><h1>STIOC Shared Terminal ${ro} <span id="badge">${token.slice(0,8)}…</span></h1>${roBanner}<div id="term"></div><script src="/viewer.js"></script></body></html>`;
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
            // B2 origin check: allow only same-origin (browser nav sends no Origin)
            // and localhost dev, plus the exact public tunnel viewer origin
            // (Origin === share.publicUrl origin). No *.loca.lt wildcard — a
            // broad suffix match would let any localtunnel site drive input.
            const origin = (req.headers.origin || "") as string;
            if (origin !== "") {
                let ok = origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1");
                if (!ok) {
                    try {
                        const parsedOrigin = new URL(origin);
                        if (share.publicUrl) {
                            const publicOrigin = new URL(share.publicUrl).origin;
                            ok = parsedOrigin.origin === publicOrigin;
                        } else {
                            ok = false;
                        }
                    } catch {
                        ok = false;
                    }
                }
                if (!ok) { ws.close(1008, "bad origin"); return; }
            }
            share.clients.add(ws);
            let msgCount = 0; let lastReset = Date.now();
            ws.on("message", (msg) => {
                if (share.readOnly) {
                    // Visible error instead of silence: tell the viewer input is ignored.
                    try { if (ws.readyState === WebSocket.OPEN) ws.send("\r\n[read-only share — input ignored]\r\n"); } catch {}
                    return;
                }
                // rate limit: 30 msg/sec
                const now = Date.now();
                if (now - lastReset > 1000) { msgCount = 0; lastReset = now; }
                if (++msgCount > 30) return;
                // Cap length and allow only terminal-safe input: printable ASCII,
                // \r \n \t \x7f and ESC (for arrows) — blocks binary/control junk
                // before it reaches writeToPty.
                let text = msg.toString().slice(0, 1024);
                text = text.replace(/[^\x09\x0a\x0d\x1b\x7f\x20-\x7e]/g, "");
                if (text.length === 0) return;
                try { share.onInput?.(text, share.token); } catch {}
            });
            ws.on("close", () => share.clients.delete(ws));
            ws.on("error", () => share.clients.delete(ws));
        });
        this.httpServer.listen(0, "127.0.0.1");
        return this.httpServer;
    }

    async start(broadcast: (listener: (data: string) => void) => { dispose(): void }, writeToPty: (data: string, token: string) => void, opts?: { readOnly?: boolean; ttlMs?: number; maxClients?: number }): Promise<{url:string, publicUrl?:string, token:string, expiresAt:number}> {
        const server = this.ensureServer();
        if (!server.listening) await new Promise<void>((r)=>server.once("listening", r));
        const token = crypto.randomBytes(16).toString("hex");
        const now = Date.now();
        // B2: clamp renderer-supplied values (defense in depth; Main also validates).
        const rawTtl = opts?.ttlMs;
        const ttlMs = (typeof rawTtl === "number" && Number.isFinite(rawTtl))
            ? Math.min(Math.max(Math.floor(rawTtl), 60_000), 12 * 60 * 60 * 1000)
            : this.defaultTtlMs;
        const rawClients = opts?.maxClients;
        const maxClients = (typeof rawClients === "number" && Number.isFinite(rawClients))
            ? Math.min(Math.max(Math.floor(rawClients), 1), 20)
            : 5;
        const expiresAt = now + ttlMs;
        const share: Share = {
            token, url: "", createdAt: now, expiresAt,
            maxClients,
            // B2: secure default — read-only unless the owner explicitly opts into writable.
            readOnly: opts?.readOnly === false ? false : true,
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

    // B2: token-routed broadcast. A missing token is honored ONLY when exactly one
    // share exists (single-share UX: renderer pushes output without tracking tokens);
    // with 2+ shares a token-less push is dropped with a warning to prevent
    // cross-session leaks. Renderer fans out per-token (sharePush(data, token)),
    // so multi-share stays working — the drop only catches legacy callers.
    broadcast(data: string, token?: string) {
        if (token) {
            const s = this.shares.get(token);
            if (!s) { try { console.warn(`[share] broadcast: unknown token ${String(token).slice(0,8)}… dropped`); } catch {} return; }
            for (const c of s.clients) if (c.readyState === WebSocket.OPEN) c.send(data);
            return;
        }
        if (this.shares.size !== 1) { try { console.warn(`[share] broadcast: token-less push dropped (${this.shares.size} shares)`); } catch {} return; }
        const only = this.shares.values().next().value as Share | undefined;
        if (!only) return;
        for (const c of only.clients) if (c.readyState === WebSocket.OPEN) c.send(data);
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

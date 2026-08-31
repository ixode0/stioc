import * as http from "http";
import {WebSocketServer, WebSocket} from "ws";

// Simple share server: HTTP serves viewer, WS broadcasts PTY data bidirectionally
export class ShareServer {
    private httpServer?: http.Server;
    private wss?: WebSocketServer;
    private url?: string;
    private clients = new Set<WebSocket>();
    private onData?: (data: string) => void;
    private onInput?: (data: string) => void;

    async start(broadcast: (listener: (data: string) => void) => { dispose(): void }, writeToPty: (data: string) => void): Promise<string> {
        if (this.httpServer) return this.url!;

        this.onInput = writeToPty;

        const viewerHtml = `<!doctype html><html><head><meta charset="utf-8"><title>STIOC Share</title>
<style>body{margin:0;background:#111;color:#eee;font-family:monospace} #term{padding:10px;white-space:pre-wrap;word-break:break-all} h1{font-size:14px;padding:10px;margin:0;background:#222}</style>
</head><body><h1>STIOC Shared Terminal — read-only + type to send</h1><div id="term"></div><script>
const term=document.getElementById('term'); const ws=new WebSocket('ws://'+location.host+'/ws');
ws.onmessage=e=>{ term.textContent+=e.data; window.scrollTo(0,document.body.scrollHeight); };
ws.onopen=()=> term.textContent+='[connected]\\n';
ws.onclose=()=> term.textContent+='\\n[disconnected]\\n';
document.addEventListener('keydown',e=>{
  if(e.key.length===1) ws.send(e.key);
  else if(e.key==='Enter') ws.send('\\r');
  else if(e.key==='Backspace') ws.send('\\x7f');
});
</script></body></html>`;

        this.httpServer = http.createServer((req, res) => {
            if (req.url === "/ws") { res.writeHead(426); res.end(); return; }
            res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
            res.end(viewerHtml);
        });

        this.wss = new WebSocketServer({server: this.httpServer, path: "/ws"});
        this.wss.on("connection", (ws) => {
            this.clients.add(ws);
            ws.on("message", (msg) => {
                const text = msg.toString();
                try { this.onInput?.(text); } catch {}
            });
            ws.on("close", () => this.clients.delete(ws));
        });

        this.onData = (data: string) => {
            for (const c of this.clients) if (c.readyState === WebSocket.OPEN) c.send(data);
        };
        // subscribe to PTY broadcast
        const disp = broadcast((data) => this.onData?.(data));
        // store dispose to call on stop
        (this as any)._disp = disp;

        await new Promise<void>((resolve) => this.httpServer!.listen(0, "127.0.0.1", () => resolve()));
        const addr = this.httpServer.address() as any;
        const host = addr.address === "127.0.0.1" ? "localhost" : addr.address;
        this.url = `http://${host}:${addr.port}`;
        return this.url;
    }

    broadcast(data: string) {
        for (const c of this.clients) if (c.readyState === WebSocket.OPEN) c.send(data);
    }

    getUrl() { return this.url; }

    async stop(): Promise<void> {
        try { (this as any)._disp?.dispose?.(); } catch {}
        for (const c of this.clients) try { c.close(); } catch {}
        this.clients.clear();
        await new Promise<void>((r) => this.wss ? this.wss.close(() => r()) : r());
        await new Promise<void>((r) => this.httpServer ? this.httpServer.close(() => r()) : r());
        this.wss = undefined;
        this.httpServer = undefined;
        this.url = undefined;
        this.onData = undefined;
        this.onInput = undefined;
    }

    isRunning() { return !!this.httpServer; }
}

export const shareServer = new ShareServer();

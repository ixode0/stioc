// Share viewer static assets — served as external /viewer.js + /viewer.css
// so the viewer page CSP can stay `script-src 'self'` with no 'unsafe-inline'.
// HTML carries only data-* attributes (data-ro); all logic lives here.
export const VIEWER_CSS = `body{margin:0;background:#0f1115;color:#eee;font-family:monospace}
#term{padding:10px;white-space:pre-wrap;word-break:break-all}
h1{font-size:13px;padding:10px;margin:0;background:#1a1d24;border-bottom:1px solid #2a2f3a}
#badge{float:right;opacity:.7}
#copy-btn{margin:8px 10px;padding:6px 12px;background:#1a1d24;color:#eee;border:1px solid #2a2f3a;border-radius:4px;cursor:pointer;font-family:monospace}
#copy-btn:hover{background:#2a2f3a}
.hint{padding:8px 10px;color:#ffd666;font-size:12px}
.ro-banner{background:#3a2b00;color:#ffd666;font-size:12px;padding:6px 10px;border-bottom:1px solid #6b5200}
.rw-banner{background:#3a0000;color:#ff9d9d;font-size:12px;padding:6px 10px;border-bottom:1px solid #7a1f1f}
`;

export const VIEWER_JS = `(() => {
  const params = new URLSearchParams(location.search);
  const token = params.get('token') || '';
  const term = document.getElementById('term');
  const readOnly = document.body.dataset.ro !== '0';
  const ro = readOnly ? '(read-only)' : '(read-write)';
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(proto + '//' + location.host + '/ws?token=' + encodeURIComponent(token));
  ws.onmessage = (e) => { term.textContent += e.data; window.scrollTo(0, document.body.scrollHeight); };
  ws.onopen = () => { term.textContent += '[connected ' + ro + ']\\n'; };
  ws.onclose = (e) => { term.textContent += '\\n[disconnected ' + (e.reason || e.code) + ']\\nОбнови страницу, если владелец ещё шарит, иначе попроси новую ссылку\\n'; ensureCopyBtn(); };
  function ensureCopyBtn() {
    if (document.getElementById('copy-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'copy-btn';
    btn.textContent = 'Copy output';
    btn.onclick = () => { try { navigator.clipboard.writeText(term.textContent); btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy output'; }, 1500); } catch (e2) {} };
    document.body.appendChild(btn);
  }
  if (!readOnly) {
    document.addEventListener('keydown', (e) => {
      if (ws.readyState !== 1) return;
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { ws.send(e.key); e.preventDefault(); }
      else if (e.key === 'Enter') { ws.send('\\r'); e.preventDefault(); }
      else if (e.key === 'Backspace') { ws.send('\\x7f'); e.preventDefault(); }
    });
  }
})();
`;

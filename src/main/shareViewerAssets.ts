// Share viewer static assets — served as external /viewer.js + /viewer.css
// so the viewer page CSP can stay `script-src 'self'` with no 'unsafe-inline'.
// HTML carries only data-* attributes (data-ro, data-expires); all logic lives here.
export const VIEWER_CSS = `body{margin:0;background:#0f1115;color:#eee;font-family:monospace}
#term{padding:10px;white-space:pre-wrap;word-break:break-all}
h1{font-size:13px;padding:10px;margin:0;background:#1a1d24;border-bottom:1px solid #2a2f3a}
#badge{float:right;opacity:.7}
#meta{display:flex;gap:16px;align-items:center;padding:6px 10px;font-size:12px;color:#9fb0c3;border-bottom:1px solid #2a2f3a;background:#14161c}
#sub{opacity:.9}
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
  const ttlEl = document.getElementById('ttl');
  const viewersEl = document.getElementById('viewers');
  const readOnly = document.body.dataset.ro !== '0';
  const expiresAt = parseInt(document.body.dataset.expires || '0', 10) || 0;
  const ro = readOnly ? '(read-only / только просмотр)' : '(read-write / можно печатать)';
  function minsLeft() { return Math.max(0, Math.ceil((expiresAt - Date.now()) / 60000)); }
  function tickTtl() {
    if (!ttlEl || !expiresAt) return;
    const m = minsLeft();
    ttlEl.textContent = 'осталось ' + m + ' мин / ' + m + ' min left';
  }
  async function pollStatus() {
    if (!viewersEl || !token) return;
    try {
      const r = await fetch('/status?token=' + encodeURIComponent(token));
      if (r.status === 401) { viewersEl.textContent = 'зрители: ? / viewers: ?'; return; }
      const j = await r.json();
      if (j && j.ok) viewersEl.textContent = 'зрители: ' + j.clients + ' / viewers: ' + j.clients;
    } catch (e) {}
  }
  tickTtl(); setInterval(tickTtl, 30000);
  pollStatus(); setInterval(pollStatus, 10000);
  ensureCopyBtn();
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(proto + '//' + location.host + '/ws?token=' + encodeURIComponent(token));
  ws.onmessage = (e) => { term.textContent += e.data; window.scrollTo(0, document.body.scrollHeight); };
  ws.onopen = () => { term.textContent += '[connected ' + ro + ']\\n'; };
  ws.onclose = (e) => { term.textContent += '\\n[disconnected / отключено ' + (e.reason || e.code) + ']\\nRefresh if the owner still shares, else ask for a new link. / Обнови страницу, если владелец ещё шарит, иначе попроси новую ссылку.\\n'; ensureCopyBtn(); };
  function ensureCopyBtn() {
    if (document.getElementById('copy-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'copy-btn';
    btn.textContent = 'Copy output';
    btn.onclick = () => { try { navigator.clipboard.writeText(term.textContent).then(() => { btn.textContent = 'Copied! / Скопировано!'; setTimeout(() => { btn.textContent = 'Copy output'; }, 1500); }).catch(() => { btn.textContent = 'Copy manually: select + Ctrl+C / Скопируй руками'; }); } catch (e2) { btn.textContent = 'Copy manually: select + Ctrl+C / Скопируй руками'; } };
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

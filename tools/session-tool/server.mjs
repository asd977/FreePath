import { createServer } from 'node:http';

const PORT = Number.parseInt(process.env.PORT ?? '3001', 10);
const CHATGPT_SESSION_URL = 'https://chatgpt.com/api/auth/session';

let latestSession = null;
let latestUpdatedAt = null;

const BOOKMARKLET_CODE = `(async()=>{try{const r=await fetch('/api/auth/session',{credentials:'include'});const t=await r.text();await fetch('http://localhost:${PORT}/api/session/import',{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain'},body:t});alert('Session 已发送到本地工具页，请回到 localhost 查看');}catch(e){alert('获取失败: '+(e?.message||e));}})();`;
const BOOKMARKLET_LINK = `javascript:${encodeURIComponent(BOOKMARKLET_CODE)}`;

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ChatGPT Session 获取工具</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
    .wrap { max-width: 980px; margin: 0 auto; padding: 24px; }
    .header { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
    button { border: 0; border-radius: 8px; padding: 10px 14px; cursor: pointer; background: #111827; color: #fff; }
    button:disabled { opacity: .6; cursor: not-allowed; }
    .ghost { background: #334155; }
    textarea, pre, input { width: 100%; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; }
    textarea, input { padding: 10px; box-sizing: border-box; }
    textarea { min-height: 70px; }
    pre { padding: 12px; overflow: auto; min-height: 220px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-top: 14px; }
    .err { color: #b91c1c; background: #fef2f2; border-color: #fecaca; }
    .ok { color: #166534; background: #f0fdf4; border-color: #bbf7d0; }
    .row { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    code { background: #e2e8f0; border-radius: 6px; padding: 2px 6px; }
    .small { color:#475569; font-size: 13px; }
  </style>
</head>
<body>
  <main class="wrap">
    <div class="header">
      <h1>ChatGPT Session 获取工具（隔离版）</h1>
      <div>
        <button id="refresh" class="ghost">刷新结果</button>
        <button id="cookieGet">Cookie 模式获取</button>
      </div>
    </div>

    <div class="card">
      <h3>推荐：免 Cookie（和你说的“别人那种”一致）</h3>
      <ol>
        <li>把下面「书签脚本」拖到浏览器书签栏，或复制到书签 URL。</li>
        <li>打开并登录 <code>https://chatgpt.com</code>。</li>
        <li>在 ChatGPT 页面点击该书签，Session 会自动回传到本地工具。</li>
      </ol>
      <div class="row">
        <input id="bookmarklet" readonly value="${BOOKMARKLET_LINK}" />
        <button id="copyBookmarklet" class="ghost">复制脚本</button>
      </div>
      <p class="small">提示：这是在 ChatGPT 域内请求 <code>/api/auth/session</code>，所以不需要你手工粘 Cookie。</p>
    </div>

    <div class="card">
      <h3>备用：Cookie 模式</h3>
      <p class="small">如果书签模式在你的浏览器策略下不可用，再使用该模式。</p>
      <textarea id="cookie" placeholder="粘贴完整 Cookie，例如：__Secure-next-auth.session-token=...; cf_clearance=...;"></textarea>
    </div>

    <div id="msg" class="card" style="display:none"></div>

    <div class="card">
      <h3>Session JSON</h3>
      <p class="small" id="updated">尚未收到 session</p>
      <pre id="out">尚未获取 Session</pre>
    </div>
  </main>

  <script>
    const refreshBtn = document.getElementById('refresh');
    const cookieBtn = document.getElementById('cookieGet');
    const cookieEl = document.getElementById('cookie');
    const outEl = document.getElementById('out');
    const msgEl = document.getElementById('msg');
    const updatedEl = document.getElementById('updated');
    const bookmarkletEl = document.getElementById('bookmarklet');
    const copyBookmarkletBtn = document.getElementById('copyBookmarklet');

    function setMessage(text, type = 'ok') {
      msgEl.style.display = 'block';
      msgEl.className = 'card ' + (type === 'error' ? 'err' : 'ok');
      msgEl.textContent = text;
    }

    async function refreshLatest() {
      const res = await fetch('/api/session/latest');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || '读取失败');
      }

      if (!data.session) {
        outEl.textContent = '尚未获取 Session';
        updatedEl.textContent = '尚未收到 session';
        return;
      }

      outEl.textContent = JSON.stringify(data.session, null, 2);
      updatedEl.textContent = '最近更新时间: ' + (data.updatedAt || '-');
    }

    copyBookmarkletBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(bookmarkletEl.value);
        setMessage('书签脚本已复制。请新建浏览器书签并把 URL 替换为该脚本。');
      } catch {
        setMessage('复制失败，请手动复制输入框内容。', 'error');
      }
    });

    refreshBtn.addEventListener('click', async () => {
      try {
        await refreshLatest();
        setMessage('已刷新。');
      } catch (e) {
        setMessage(e instanceof Error ? e.message : '刷新失败', 'error');
      }
    });

    cookieBtn.addEventListener('click', async () => {
      const cookie = cookieEl.value.trim();
      if (!cookie) {
        setMessage('请先粘贴 Cookie 再获取。', 'error');
        return;
      }

      cookieBtn.disabled = true;
      setMessage('Cookie 模式请求中...');
      try {
        const res = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cookie })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || '获取失败');
        }

        outEl.textContent = JSON.stringify(data, null, 2);
        updatedEl.textContent = '最近更新时间: ' + new Date().toISOString();
        setMessage('Cookie 模式获取成功。');
      } catch (err) {
        setMessage(err instanceof Error ? err.message : '未知错误', 'error');
      } finally {
        cookieBtn.disabled = false;
      }
    });

    refreshLatest().catch(() => {});
  </script>
</body>
</html>`;

function json(res, statusCode, body, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }
  return body;
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS' && req.url === '/api/session/import') {
    res.writeHead(204, {
      'access-control-allow-origin': 'https://chatgpt.com',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/session/latest') {
    json(res, 200, { session: latestSession, updatedAt: latestUpdatedAt });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/session/import') {
    try {
      const raw = await readBody(req);
      const data = JSON.parse(raw || '{}');

      latestSession = data;
      latestUpdatedAt = new Date().toISOString();

      json(
        res,
        200,
        { ok: true, updatedAt: latestUpdatedAt },
        { 'access-control-allow-origin': 'https://chatgpt.com' }
      );
      return;
    } catch (error) {
      json(
        res,
        400,
        { error: '导入失败', detail: error instanceof Error ? error.message : String(error) },
        { 'access-control-allow-origin': 'https://chatgpt.com' }
      );
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/session') {
    try {
      const body = await readBody(req);
      const parsed = JSON.parse(body || '{}');
      const cookie = typeof parsed.cookie === 'string' ? parsed.cookie.trim() : '';

      if (!cookie) {
        json(res, 400, { error: 'cookie 不能为空' });
        return;
      }

      const response = await fetch(CHATGPT_SESSION_URL, {
        headers: {
          cookie,
          accept: 'application/json',
          'user-agent': req.headers['user-agent'] ?? 'Mozilla/5.0',
        },
      });

      const text = await response.text();

      if (!response.ok) {
        json(res, response.status, {
          error: `ChatGPT 返回 ${response.status}`,
          detail: text.slice(0, 500),
        });
        return;
      }

      const data = JSON.parse(text);
      latestSession = data;
      latestUpdatedAt = new Date().toISOString();

      json(res, 200, data);
      return;
    } catch (error) {
      json(res, 500, {
        error: '服务异常',
        detail: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }

  json(res, 404, { error: 'Not Found' });
});

server.listen(PORT, () => {
  console.log(`Session tool is running at http://localhost:${PORT}`);
});

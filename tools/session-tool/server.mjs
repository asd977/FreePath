import { createServer } from 'node:http';

const PORT = Number.parseInt(process.env.PORT ?? '3001', 10);
const CHATGPT_SESSION_URL = 'https://chatgpt.com/api/auth/session';

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ChatGPT Session 获取工具</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
    .wrap { max-width: 900px; margin: 0 auto; padding: 24px; }
    .header { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
    button { border: 0; border-radius: 8px; padding: 10px 14px; cursor: pointer; background: #111827; color: #fff; }
    button:disabled { opacity: .6; cursor: not-allowed; }
    .ghost { background: #334155; }
    textarea, pre { width: 100%; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; }
    textarea { min-height: 90px; padding: 10px; }
    pre { padding: 12px; overflow: auto; min-height: 220px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-top: 14px; }
    .err { color: #b91c1c; background: #fef2f2; border-color: #fecaca; }
    code { background: #e2e8f0; border-radius: 6px; padding: 2px 6px; }
  </style>
</head>
<body>
  <main class="wrap">
    <div class="header">
      <h1>ChatGPT Session 获取工具（隔离版）</h1>
      <div>
        <button id="open" class="ghost">打开 ChatGPT 登录</button>
        <button id="get">获取 Session</button>
      </div>
    </div>

    <div class="card">
      <ol>
        <li>点击右上角「打开 ChatGPT 登录」，在新标签页完成登录。</li>
        <li>把完整 Cookie（浏览器开发者工具 Network 请求头里的 <code>cookie</code>）粘贴到下面。</li>
        <li>点击「获取 Session」。</li>
      </ol>
      <p>说明：浏览器跨域限制导致 localhost 页面不能直接读 chatgpt.com 登录态，所以改成服务端请求，和主应用完全隔离。</p>
    </div>

    <div class="card">
      <label for="cookie"><strong>ChatGPT Cookie（必填）</strong></label>
      <textarea id="cookie" placeholder="粘贴完整 Cookie，例如：__Secure-next-auth.session-token=...; cf_clearance=...;"></textarea>
    </div>

    <div id="msg" class="card" style="display:none"></div>

    <div class="card">
      <h3>Session JSON</h3>
      <pre id="out">尚未获取 Session</pre>
    </div>
  </main>

  <script>
    const getBtn = document.getElementById('get');
    const openBtn = document.getElementById('open');
    const cookieEl = document.getElementById('cookie');
    const outEl = document.getElementById('out');
    const msgEl = document.getElementById('msg');

    openBtn.addEventListener('click', () => {
      window.open('https://chatgpt.com', '_blank', 'noopener,noreferrer');
    });

    function setMessage(text, isError = false) {
      msgEl.style.display = 'block';
      msgEl.className = 'card' + (isError ? ' err' : '');
      msgEl.textContent = text;
    }

    getBtn.addEventListener('click', async () => {
      const cookie = cookieEl.value.trim();
      if (!cookie) {
        setMessage('请先粘贴 Cookie 再获取。', true);
        return;
      }

      getBtn.disabled = true;
      setMessage('请求中...');
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
        setMessage('获取成功。');
      } catch (err) {
        const msg = err instanceof Error ? err.message : '未知错误';
        setMessage(msg, true);
      } finally {
        getBtn.disabled = false;
      }
    });
  </script>
</body>
</html>`;

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/session') {
    try {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }

      const parsed = JSON.parse(body || '{}');
      const cookie = typeof parsed.cookie === 'string' ? parsed.cookie.trim() : '';

      if (!cookie) {
        res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'cookie 不能为空' }));
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
        res.writeHead(response.status, { 'content-type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            error: `ChatGPT 返回 ${response.status}`,
            detail: text.slice(0, 500),
          })
        );
        return;
      }

      const data = JSON.parse(text);

      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
      return;
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          error: '服务异常',
          detail: error instanceof Error ? error.message : String(error),
        })
      );
      return;
    }
  }

  res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, () => {
  console.log(`Session tool is running at http://localhost:${PORT}`);
});

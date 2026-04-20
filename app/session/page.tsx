'use client';

import { useMemo, useState } from 'react';

type SessionResponse = {
  accessToken?: string;
  expires?: string;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    id?: string;
  };
  [key: string]: unknown;
};

const SESSION_ENDPOINT = 'https://chatgpt.com/api/auth/session';

export default function SessionPage() {
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [error, setError] = useState<string>('');

  const summary = useMemo(() => {
    if (!session) {
      return null;
    }

    return {
      accessToken: session.accessToken ? `${session.accessToken.slice(0, 24)}...` : '未返回 accessToken',
      expires: session.expires ?? '未返回 expires',
      email: session.user?.email ?? '未返回 user.email',
    };
  }, [session]);

  const getSession = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(SESSION_ENDPOINT, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }

      const data = (await response.json()) as SessionResponse;

      if (!data?.accessToken) {
        throw new Error('已请求成功，但未拿到 accessToken。请确认已在 ChatGPT 完成登录。');
      }

      setSession(data);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : '未知错误';
      setError(`${message}。如浏览器拦截跨域，请直接打开 ${SESSION_ENDPOINT} 复制结果。`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">ChatGPT Session 获取工具</h1>
        <button
          type="button"
          onClick={getSession}
          disabled={loading}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? '获取中...' : '获取 Session'}
        </button>
      </header>

      <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
        <li>先在当前浏览器登录 ChatGPT。</li>
        <li>点击上方「获取 Session」按钮。</li>
        <li>成功后可在下方查看和复制 session JSON。</li>
      </ol>

      {summary ? (
        <section className="rounded-md border border-green-200 bg-green-50 p-4 text-sm">
          <h2 className="mb-2 font-semibold">获取成功</h2>
          <ul className="space-y-1">
            <li>accessToken: {summary.accessToken}</li>
            <li>expires: {summary.expires}</li>
            <li>email: {summary.email}</li>
          </ul>
        </section>
      ) : null}

      {error ? <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}

      <section className="rounded-md border p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Session 原始 JSON</h2>
        <pre className="max-h-[420px] overflow-auto rounded bg-gray-100 p-3 text-xs leading-5">
          {session ? JSON.stringify(session, null, 2) : '尚未获取 Session'}
        </pre>
      </section>
    </main>
  );
}

import { PolymarketBook, PolymarketDiscoverResponse, PolymarketMarketRaw, PolymarketSnapshotResponse, SidePrice } from "@/types/polymarket";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

const FIVE_MIN_MS = 5 * 60 * 1000;
const SNAPSHOT_TTL_MS = 1800;
const REQUEST_TIMEOUT_MS = 8000;
const REQUEST_RETRY = 2;
const POLYMARKET_PROXY_ENV_KEYS = ["POLYMARKET_PROXY_URL", "HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "ALL_PROXY", "all_proxy"] as const;

type Cache = {
  key: string;
  snapshot: PolymarketSnapshotResponse;
  createdAt: number;
};

let snapshotCache: Cache | null = null;
let proxyDispatcherPromise: Promise<unknown | null> | null = null;

function readProxyUrl(): string | null {
  for (const key of POLYMARKET_PROXY_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

async function getProxyDispatcher(): Promise<unknown | null> {
  if (proxyDispatcherPromise) return proxyDispatcherPromise;

  const proxyUrl = readProxyUrl();
  if (!proxyUrl) {
    proxyDispatcherPromise = Promise.resolve(null);
    return proxyDispatcherPromise;
  }

  proxyDispatcherPromise = (async () => {
    try {
      const { ProxyAgent } = await import("undici");
      return new ProxyAgent(proxyUrl);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`检测到代理 ${proxyUrl}，但初始化失败: ${detail}`);
    }
  })();

  return proxyDispatcherPromise;
}

function parseJsonMaybe<T>(value: string | T[] | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function bestBid(book: PolymarketBook): number | null {
  const price = book.bids?.[0]?.price;
  if (!price) return null;
  const value = Number(price);
  return Number.isFinite(value) ? value : null;
}

function bestAsk(book: PolymarketBook): number | null {
  const price = book.asks?.[0]?.price;
  if (!price) return null;
  const value = Number(price);
  return Number.isFinite(value) ? value : null;
}

function midpoint(bid: number | null, ask: number | null): number | null {
  if (bid !== null && ask !== null) return (bid + ask) / 2;
  if (bid !== null) return bid;
  if (ask !== null) return ask;
  return null;
}

function toSidePrice(tokenId: string, book: PolymarketBook, seed: number | null): SidePrice {
  const bid = bestBid(book);
  const ask = bestAsk(book);
  return {
    tokenId,
    bid,
    ask,
    mid: midpoint(bid, ask) ?? seed,
  };
}

export function currentWindowStartTs(nowMs = Date.now()): number {
  return Math.floor(nowMs / FIVE_MIN_MS) * 300;
}

async function requestText(url: string, accept: string): Promise<string> {
  let lastError: Error | null = null;
  const proxyDispatcher = await getProxyDispatcher();
  const proxyUrl = readProxyUrl();
  for (let attempt = 0; attempt <= REQUEST_RETRY; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: accept,
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        cache: "no-store",
        signal: controller.signal,
        ...(proxyDispatcher ? { dispatcher: proxyDispatcher } : {}),
      } as RequestInit & { dispatcher?: unknown });

      if (!response.ok) {
        const body = (await response.text()).slice(0, 180).replace(/\s+/g, " ").trim();
        throw new Error(`上游返回 HTTP ${response.status} (${new URL(url).host})${body ? `: ${body}` : ""}`);
      }

      return response.text();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const proxyHint = proxyUrl ? `, proxy=${proxyUrl}` : "";
      lastError = new Error(`请求失败 ${new URL(url).host} (attempt ${attempt + 1}/${REQUEST_RETRY + 1}${proxyHint}): ${reason}`);
      if (attempt < REQUEST_RETRY) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error(`请求失败 ${new URL(url).host}`);
}

async function requestJson<T>(url: string): Promise<T> {
  const text = await requestText(url, "application/json,text/plain,*/*");
  return JSON.parse(text) as T;
}

export async function discoverBtc5mMarket(): Promise<PolymarketDiscoverResponse> {
  const html = await requestText(
    "https://polymarket.com/crypto/5M",
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  );

  const matches = Array.from(html.matchAll(/btc-updown-5m-(\d{10})/g));
  const numbers = Array.from(new Set(matches.map((item) => Number(item[1])).filter(Number.isFinite))).sort((a, b) => a - b);

  if (numbers.length === 0) {
    throw new Error("在 /crypto/5M 页面里没有解析到 BTC 5m slug");
  }

  const currentStartTs = currentWindowStartTs();
  const score = (startTs: number) => {
    if (startTs === currentStartTs) return [0, 0] as const;
    if (startTs === currentStartTs + 300) return [1, 300] as const;
    if (startTs === currentStartTs - 300) return [2, 300] as const;
    return [10, Math.abs(startTs - currentStartTs)] as const;
  };

  const ordered = [...numbers].sort((a, b) => {
    const scoreA = score(a);
    const scoreB = score(b);
    return scoreA[0] - scoreB[0] || scoreA[1] - scoreB[1];
  });

  const chosen = ordered[0];
  const startUtc = new Date(chosen * 1000);
  const endUtc = new Date((chosen + 300) * 1000);

  return {
    ok: true,
    source: "https://polymarket.com/crypto/5M",
    slug: `btc-updown-5m-${chosen}`,
    startTs: chosen,
    endTs: chosen + 300,
    startUtc: startUtc.toISOString(),
    endUtc: endUtc.toISOString(),
    startEt: startUtc.toLocaleString("sv-SE", { timeZone: "America/New_York" }).replace(" ", "T"),
    endEt: endUtc.toLocaleString("sv-SE", { timeZone: "America/New_York" }).replace(" ", "T"),
    currentStartTs,
    candidates: ordered.slice(0, 10).map((v) => `btc-updown-5m-${v}`),
  };
}

function parseUpDownTokens(market: PolymarketMarketRaw): {
  upToken: string;
  downToken: string;
  seedUp: number | null;
  seedDown: number | null;
} {
  const outcomes = parseJsonMaybe<string>(market.outcomes).map((v) => String(v).trim().toUpperCase());
  const outcomePrices = parseJsonMaybe<number | string>(market.outcomePrices).map((v) => Number(v));
  const tokenIds = parseJsonMaybe<string>(market.clobTokenIds).map((v) => String(v));

  const idxUp = outcomes.findIndex((v) => v === "UP" || v === "YES");
  const idxDown = outcomes.findIndex((v) => v === "DOWN" || v === "NO");

  if (idxUp < 0 || idxDown < 0) {
    throw new Error("没识别出 UP/DOWN token");
  }

  const upToken = tokenIds[idxUp];
  const downToken = tokenIds[idxDown];
  if (!upToken || !downToken) {
    throw new Error("token 数据缺失");
  }

  return {
    upToken,
    downToken,
    seedUp: Number.isFinite(outcomePrices[idxUp]) ? Number(outcomePrices[idxUp]) : null,
    seedDown: Number.isFinite(outcomePrices[idxDown]) ? Number(outcomePrices[idxDown]) : null,
  };
}

export async function loadPolymarketSnapshot(forceRefresh = false): Promise<PolymarketSnapshotResponse> {
  const discovery = await discoverBtc5mMarket();
  const cacheKey = `${discovery.slug}:${discovery.currentStartTs}`;
  const now = Date.now();

  if (!forceRefresh && snapshotCache && snapshotCache.key === cacheKey && now - snapshotCache.createdAt <= SNAPSHOT_TTL_MS) {
    return snapshotCache.snapshot;
  }

  const market = await requestJson<PolymarketMarketRaw>(
    `https://gamma-api.polymarket.com/markets/slug/${encodeURIComponent(discovery.slug)}`,
  );
  const { upToken, downToken, seedUp, seedDown } = parseUpDownTokens(market);

  const [upBook, downBook] = await Promise.all([
    requestJson<PolymarketBook>(`https://clob.polymarket.com/book?token_id=${encodeURIComponent(upToken)}`),
    requestJson<PolymarketBook>(`https://clob.polymarket.com/book?token_id=${encodeURIComponent(downToken)}`),
  ]);

  const snapshot: PolymarketSnapshotResponse = {
    ok: true,
    market: {
      eventTitle: market.question || market.title || discovery.slug,
      slug: discovery.slug,
      startDate: market.startDate || discovery.startUtc,
      endDate: market.endDate || discovery.endUtc,
      source: discovery.source,
    },
    prices: {
      up: toSidePrice(upToken, upBook, seedUp),
      down: toSidePrice(downToken, downBook, seedDown),
    },
    candidates: discovery.candidates,
    fetchedAt: new Date().toISOString(),
  };

  snapshotCache = {
    key: cacheKey,
    snapshot,
    createdAt: now,
  };

  return snapshot;
}

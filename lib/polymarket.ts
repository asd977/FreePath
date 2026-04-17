import { PolymarketBook, PolymarketDiscoverResponse, PolymarketMarketRaw, PolymarketSnapshotResponse, SidePrice } from "@/types/polymarket";
import { ProxyAgent, request } from "undici";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

const FIVE_MIN_MS = 5 * 60 * 1000;
const SNAPSHOT_TTL_MS = 1800;
const STALE_FALLBACK_MS = 30_000;
const RETRY_COUNT = 3;

type Cache = {
  key: string;
  snapshot: PolymarketSnapshotResponse;
  createdAt: number;
};

let snapshotCache: Cache | null = null;
let proxyAgent: ProxyAgent | null | undefined;
let proxyUrlCache: string | null | undefined;

function getProxyAgent() {
  if (proxyAgent !== undefined) return proxyAgent;
  const proxyUrl = process.env.POLYMARKET_PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  proxyUrlCache = proxyUrl || null;
  proxyAgent = proxyUrl ? new ProxyAgent(proxyUrl) : null;
  return proxyAgent;
}

export function getPolymarketProxyInfo() {
  const agent = getProxyAgent();
  return {
    enabled: Boolean(agent),
    url: proxyUrlCache,
  };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
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
  const host = new URL(url).hostname;
  const agent = getProxyAgent();
  let lastError = "unknown error";

  for (let attempt = 1; attempt <= RETRY_COUNT; attempt += 1) {
    try {
      const response = await request(url, {
        method: "GET",
        headers: {
          "User-Agent": USER_AGENT,
          accept,
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        ...(agent ? { dispatcher: agent } : undefined),
      });

      if (response.statusCode >= 400) {
        throw new Error(`HTTP ${response.statusCode}`);
      }

      return response.body.text();
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < RETRY_COUNT) {
        await sleep(200 * attempt);
      }
    }
  }

  throw new Error(`请求失败 ${host} (attempt ${RETRY_COUNT}/${RETRY_COUNT}): ${lastError}`);
}

async function requestJson<T>(url: string): Promise<T> {
  const text = await requestText(url, "application/json,text/plain,*/*");
  return JSON.parse(text) as T;
}

function buildWindowCandidates(baseStartTs: number, windows = 12): number[] {
  const candidates = [baseStartTs];
  for (let i = 1; i <= windows; i += 1) {
    candidates.push(baseStartTs + i * 300, baseStartTs - i * 300);
  }
  return candidates;
}

async function discoverBtc5mFromGammaProbe(currentStartTs: number): Promise<PolymarketDiscoverResponse> {
  const starts = buildWindowCandidates(currentStartTs, 12);
  const attempts = await Promise.all(
    starts.map(async (startTs) => {
      const slug = `btc-updown-5m-${startTs}`;
      try {
        const market = await requestJson<PolymarketMarketRaw>(
          `https://gamma-api.polymarket.com/markets/slug/${encodeURIComponent(slug)}`,
        );
        const hasTokens = Boolean(market?.clobTokenIds);
        return hasTokens ? startTs : null;
      } catch {
        return null;
      }
    }),
  );

  const found = attempts.filter((v): v is number => v !== null);
  if (!found.length) {
    throw new Error("在 gamma 兜底探测中未发现可用 BTC 5m 市场");
  }

  const chosen = found[0];
  const startUtc = new Date(chosen * 1000);
  const endUtc = new Date((chosen + 300) * 1000);

  return {
    ok: true,
    source: "gamma-probe",
    slug: `btc-updown-5m-${chosen}`,
    startTs: chosen,
    endTs: chosen + 300,
    startUtc: startUtc.toISOString(),
    endUtc: endUtc.toISOString(),
    startEt: startUtc.toLocaleString("sv-SE", { timeZone: "America/New_York" }).replace(" ", "T"),
    endEt: endUtc.toLocaleString("sv-SE", { timeZone: "America/New_York" }).replace(" ", "T"),
    currentStartTs,
    candidates: found.slice(0, 10).map((v) => `btc-updown-5m-${v}`),
  };
}

export async function discoverBtc5mMarket(): Promise<PolymarketDiscoverResponse> {
  const currentStartTs = currentWindowStartTs();
  try {
    // 优先 API 直连探测，避免对 polymarket.com HTML 的硬依赖
    return await discoverBtc5mFromGammaProbe(currentStartTs);
  } catch (gammaError) {
    try {
      const html = await requestText(
        "https://www.polymarket.com/crypto/5M",
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      );

      const matches = Array.from(html.matchAll(/btc-updown-5m-(\d{10})/g));
      const numbers = Array.from(new Set(matches.map((item) => Number(item[1])).filter(Number.isFinite))).sort((a, b) => a - b);

      if (numbers.length === 0) {
        throw new Error("在 /crypto/5M 页面里没有解析到 BTC 5m slug");
      }

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
        source: "https://www.polymarket.com/crypto/5M",
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
    } catch (htmlError) {
      const gammaMessage = gammaError instanceof Error ? gammaError.message : String(gammaError);
      const htmlMessage = htmlError instanceof Error ? htmlError.message : String(htmlError);
      throw new Error(`市场发现失败：gamma=${gammaMessage}; html=${htmlMessage}`);
    }
  }
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
  const now = Date.now();
  let discovery: PolymarketDiscoverResponse;

  try {
    discovery = await discoverBtc5mMarket();
  } catch (error) {
    if (snapshotCache && now - snapshotCache.createdAt <= STALE_FALLBACK_MS) {
      return {
        ...snapshotCache.snapshot,
        fetchedAt: new Date().toISOString(),
      };
    }
    throw error;
  }

  const cacheKey = `${discovery.slug}:${discovery.currentStartTs}`;

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

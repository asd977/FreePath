import { NextRequest, NextResponse } from "next/server";
import { buildIndicatorSnapshot, buildRecommendation, parseSecId } from "@/lib/market";
import { MarketAnalysisResponse, MarketAssetType } from "@/types/market";

const QUOTE_FIELDS = "f57,f58,f43,f170,f162,f167";

type EastmoneyQuoteResponse = {
  data?: {
    f57?: string;
    f58?: string;
    f43?: number;
    f170?: number;
    f162?: number;
    f167?: number;
  };
};

type EastmoneyKlineResponse = {
  data?: {
    klines?: string[];
  };
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

function normalizeAssetType(code: string, rawType: MarketAssetType): MarketAssetType {
  if (rawType === "index") return "index";
  if (/(ETF|LOF)/i.test(code)) return "etf";
  if (/^(SH|SZ)(51|15)\d{4}$/i.test(code.replace(/[^A-Z0-9]/g, ""))) return "etf";
  return rawType;
}

function parseKlines(raw: string[]) {
  return raw
    .map((item) => item.split(","))
    .filter((parts) => parts.length >= 3)
    .map((parts) => ({
      date: parts[0],
      close: Number(parts[2]),
    }))
    .filter((row) => Number.isFinite(row.close) && row.close > 0);
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as { codes?: string[] };
    const codes = Array.isArray(payload.codes) ? payload.codes : [];
    const normalized = Array.from(new Set(codes.map((item) => item.trim()).filter(Boolean))).slice(0, 20);

    const response: MarketAnalysisResponse = {
      items: [],
      failed: [],
    };

    for (const code of normalized) {
      const parsed = parseSecId(code);
      if (!parsed) {
        response.failed.push({ code, reason: "代码格式不支持，请使用 SH600519 / SZ159915 / SH000300 这类格式" });
        continue;
      }

      try {
        const quoteUrl = `https://push2.eastmoney.com/api/qt/stock/get?secid=${parsed.secId}&fields=${QUOTE_FIELDS}`;
        const klineUrl = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${parsed.secId}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58&klt=101&fqt=0&beg=20100101&end=20500000`;

        const [quoteRes, klineRes] = await Promise.all([
          fetchJson<EastmoneyQuoteResponse>(quoteUrl),
          fetchJson<EastmoneyKlineResponse>(klineUrl),
        ]);

        const quote = quoteRes.data;
        const klines = parseKlines(klineRes.data?.klines ?? []);

        if (!quote || !Number.isFinite(quote.f43) || klines.length < 120) {
          throw new Error("行情数据不足");
        }

        const indicators = buildIndicatorSnapshot(klines);
        const peTtm = quote.f162 && quote.f162 > 0 ? quote.f162 / 100 : null;
        const pb = quote.f167 && quote.f167 > 0 ? quote.f167 / 100 : null;
        const assetType = normalizeAssetType(code, parsed.assetType);

        const recommendation = buildRecommendation({
          indicators,
          peTtm,
          assetType,
        });

        response.items.push({
          code,
          secId: parsed.secId,
          name: quote.f58 || quote.f57 || code,
          assetType,
          latestPrice: (quote.f43 ?? 0) / 100,
          dayChangePct: (quote.f170 ?? 0) / 100,
          indicators,
          valuation: {
            peTtm,
            pb,
            pePercentile5y: null,
            note:
              peTtm === null
                ? "当前数据源未返回PE，常见于指数/部分ETF"
                : "免费数据源未提供稳定的历史PE序列，已展示当前PE与价格历史分位",
          },
          score: recommendation.score,
          recommendation: recommendation.recommendation,
          reasons: recommendation.reasons,
          fetchedAt: new Date().toISOString(),
        });
      } catch (error) {
        response.failed.push({
          code,
          reason: error instanceof Error ? error.message : "获取失败",
        });
      }
    }

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ message: "请求格式错误" }, { status: 400 });
  }
}

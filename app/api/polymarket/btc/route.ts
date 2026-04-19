import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BINANCE_URL = "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT";
const CHAINLINK_URL = process.env.CHAINLINK_BTC_PRICE_URL;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json,text/plain,*/*" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

function toNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export async function GET() {
  const now = new Date().toISOString();
  let binance: number | null = null;
  let chainlink: number | null = null;

  try {
    const data = await fetchJson<{ price?: string }>(BINANCE_URL);
    binance = toNumber(data.price);
  } catch {
    binance = null;
  }

  if (CHAINLINK_URL) {
    try {
      const payload = await fetchJson<Record<string, unknown>>(CHAINLINK_URL);
      chainlink = toNumber(payload.price ?? payload.answer ?? payload.value);
    } catch {
      chainlink = null;
    }
  }

  return NextResponse.json(
    {
      ok: true,
      fetchedAt: now,
      prices: {
        chainlink,
        binance,
      },
      source: {
        chainlink: CHAINLINK_URL ? "configured" : "missing",
        binance: "binance-api",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

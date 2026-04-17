import { NextRequest, NextResponse } from "next/server";
import { getPolymarketProxyInfo, loadPolymarketSnapshot } from "@/lib/polymarket";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const force = request.nextUrl.searchParams.get("force") === "1";
    const data = await loadPolymarketSnapshot(force);
    const proxyInfo = getPolymarketProxyInfo();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
        "X-Polymarket-Proxy": proxyInfo.enabled ? "enabled" : "disabled",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "unknown error",
      },
      { status: 502 },
    );
  }
}

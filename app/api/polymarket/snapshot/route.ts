import { NextRequest, NextResponse } from "next/server";
import { loadPolymarketSnapshot } from "@/lib/polymarket";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const force = request.nextUrl.searchParams.get("force") === "1";
    const data = await loadPolymarketSnapshot(force);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
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

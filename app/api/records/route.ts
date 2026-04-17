import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    items: [],
    message: "Records API placeholder. Will be backed by database in future versions.",
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  return NextResponse.json({
    ok: true,
    item: body,
  });
}

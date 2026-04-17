import { NextResponse } from "next/server";
import { currentMonth } from "@/lib/date";
import { MonthlyRecord, RecordType } from "@/types/record";

function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function isValidType(value: unknown): value is RecordType {
  return value === "deposit" || value === "expense";
}

export async function GET() {
  return NextResponse.json({
    items: [],
    message: "Records endpoint is available. Persistence is not configured yet.",
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<MonthlyRecord>;
    const month = isValidMonth(body.month) ? body.month : currentMonth();
    if (typeof body.amount !== "number" || body.amount < 0 || !isValidType(body.type)) {
      return NextResponse.json({ ok: false, error: "Invalid record payload" }, { status: 400 });
    }

    const item: MonthlyRecord = {
      id: typeof body.id === "string" && body.id ? body.id : crypto.randomUUID(),
      month,
      amount: body.amount,
      type: body.type,
      note: typeof body.note === "string" ? body.note : "",
      createdAt: typeof body.createdAt === "string" && body.createdAt ? body.createdAt : new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { DEFAULT_FINANCE_INPUTS } from "@/config/defaults";
import { evaluatePlan, generateProjectionSeries } from "@/lib/finance";
import { sanitizeFinanceInputs } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<typeof DEFAULT_FINANCE_INPUTS>;
    const inputs = sanitizeFinanceInputs({ ...DEFAULT_FINANCE_INPUTS, ...body });
    const result = evaluatePlan(inputs);
    const series = generateProjectionSeries({
      startMonth: inputs.startMonth,
      months: 120,
      principal: inputs.principal,
      monthlyContribution: inputs.monthlyContribution,
      annualReturnRatePct: inputs.annualReturnRate,
      targetPrincipal: result.targetPrincipal,
      contributeAtMonthEnd: inputs.contributeAtMonthEnd,
    });

    return NextResponse.json({
      ok: true,
      inputs,
      summary: result,
      series,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
}

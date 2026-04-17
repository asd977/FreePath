import { FinanceInputs } from "@/types/finance";

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export function sanitizeFinanceInputs(inputs: FinanceInputs): FinanceInputs {
  return {
    ...inputs,
    principal: clampNumber(inputs.principal, 0, 1_000_000_000),
    monthlyContribution: clampNumber(inputs.monthlyContribution, 0, 100_000_000),
    annualReturnRate: clampNumber(inputs.annualReturnRate, -100, 100),
    conservativeRate: clampNumber(inputs.conservativeRate, -100, 100),
    neutralRate: clampNumber(inputs.neutralRate, -100, 100),
    optimisticRate: clampNumber(inputs.optimisticRate, -100, 100),
    targetAnnualExpense: clampNumber(inputs.targetAnnualExpense, 0, 1_000_000_000),
    sideIncomeAnnual: clampNumber(inputs.sideIncomeAnnual, 0, 1_000_000_000),
    safeWithdrawalRate: clampNumber(inputs.safeWithdrawalRate, 0.1, 100),
    contributeAtMonthEnd: Boolean(inputs.contributeAtMonthEnd),
    startMonth: typeof inputs.startMonth === "string" ? inputs.startMonth : "",
    targetExitMonth: typeof inputs.targetExitMonth === "string" ? inputs.targetExitMonth : "",
  };
}

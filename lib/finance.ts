import { addMonths, monthDiff } from "@/lib/date";
import { FinanceInputs, PlannerResult, ProjectionPoint, ScenarioResult } from "@/types/finance";

const MAX_MONTHS = 600;

export function calculateTargetPrincipal(
  annualExpense: number,
  sideIncomeAnnual: number,
  safeWithdrawalRatePct: number,
): number {
  if (safeWithdrawalRatePct <= 0) return Infinity;
  const netNeed = Math.max(annualExpense - sideIncomeAnnual, 0);
  return netNeed / (safeWithdrawalRatePct / 100);
}

export function calculateAssetAtMonth(params: {
  principal: number;
  monthlyContribution: number;
  annualReturnRatePct: number;
  months: number;
  contributeAtMonthEnd: boolean;
}): number {
  const { principal, monthlyContribution, annualReturnRatePct, months, contributeAtMonthEnd } = params;
  const r = annualReturnRatePct / 100 / 12;
  let assets = principal;

  for (let i = 0; i < months; i += 1) {
    if (!contributeAtMonthEnd) {
      assets += monthlyContribution;
    }
    assets *= 1 + r;
    if (contributeAtMonthEnd) {
      assets += monthlyContribution;
    }
  }

  return assets;
}

export function estimateMonthToGoal(params: {
  principal: number;
  monthlyContribution: number;
  annualReturnRatePct: number;
  targetPrincipal: number;
  startMonth: string;
  contributeAtMonthEnd: boolean;
}): { months: number | null; reachedMonth: string | null } {
  const { principal, monthlyContribution, annualReturnRatePct, targetPrincipal, startMonth, contributeAtMonthEnd } =
    params;

  if (targetPrincipal <= principal) {
    return { months: 0, reachedMonth: startMonth };
  }

  for (let m = 1; m <= MAX_MONTHS; m += 1) {
    const assets = calculateAssetAtMonth({
      principal,
      monthlyContribution,
      annualReturnRatePct,
      months: m,
      contributeAtMonthEnd,
    });
    if (assets >= targetPrincipal) {
      return { months: m, reachedMonth: addMonths(startMonth, m) };
    }
  }

  return { months: null, reachedMonth: null };
}

export function generateProjectionSeries(params: {
  startMonth: string;
  months: number;
  principal: number;
  monthlyContribution: number;
  annualReturnRatePct: number;
  targetPrincipal: number;
  contributeAtMonthEnd: boolean;
}): ProjectionPoint[] {
  const {
    startMonth,
    months,
    principal,
    monthlyContribution,
    annualReturnRatePct,
    targetPrincipal,
    contributeAtMonthEnd,
  } = params;

  const points: ProjectionPoint[] = [];
  for (let m = 0; m <= months; m += 1) {
    points.push({
      month: addMonths(startMonth, m),
      assets: calculateAssetAtMonth({
        principal,
        monthlyContribution,
        annualReturnRatePct,
        months: m,
        contributeAtMonthEnd,
      }),
      target: targetPrincipal,
      isCurrent: m === 0,
    });
  }
  return points;
}

export function calculateScenarioResults(inputs: FinanceInputs, targetPrincipal: number): ScenarioResult[] {
  const rates: Array<{ key: ScenarioResult["key"]; rate: number }> = [
    { key: "conservative", rate: inputs.conservativeRate },
    { key: "neutral", rate: inputs.neutralRate },
    { key: "optimistic", rate: inputs.optimisticRate },
  ];

  return rates.map(({ key, rate }) => {
    const estimate = estimateMonthToGoal({
      principal: inputs.principal,
      monthlyContribution: inputs.monthlyContribution,
      annualReturnRatePct: rate,
      targetPrincipal,
      startMonth: inputs.startMonth,
      contributeAtMonthEnd: inputs.contributeAtMonthEnd,
    });
    return {
      key,
      rate,
      monthsToGoal: estimate.months,
      reachedMonth: estimate.reachedMonth,
    };
  });
}

export function calculateAdvanceByExtraContribution(params: {
  inputs: FinanceInputs;
  targetPrincipal: number;
  extraPerMonth: number;
}): number | null {
  const baseline = estimateMonthToGoal({
    principal: params.inputs.principal,
    monthlyContribution: params.inputs.monthlyContribution,
    annualReturnRatePct: params.inputs.annualReturnRate,
    targetPrincipal: params.targetPrincipal,
    startMonth: params.inputs.startMonth,
    contributeAtMonthEnd: params.inputs.contributeAtMonthEnd,
  });

  const improved = estimateMonthToGoal({
    principal: params.inputs.principal,
    monthlyContribution: params.inputs.monthlyContribution + params.extraPerMonth,
    annualReturnRatePct: params.inputs.annualReturnRate,
    targetPrincipal: params.targetPrincipal,
    startMonth: params.inputs.startMonth,
    contributeAtMonthEnd: params.inputs.contributeAtMonthEnd,
  });

  if (baseline.months === null || improved.months === null) return null;
  return Math.max(baseline.months - improved.months, 0);
}

export function calculateTargetReductionBySideIncome(params: {
  annualExpense: number;
  sideIncomeAnnual: number;
  safeWithdrawalRate: number;
  extraSideIncomeAnnual: number;
}): number {
  const current = calculateTargetPrincipal(params.annualExpense, params.sideIncomeAnnual, params.safeWithdrawalRate);
  const improved = calculateTargetPrincipal(
    params.annualExpense,
    params.sideIncomeAnnual + params.extraSideIncomeAnnual,
    params.safeWithdrawalRate,
  );
  return Math.max(current - improved, 0);
}

export function evaluatePlan(inputs: FinanceInputs): PlannerResult {
  const targetPrincipal = calculateTargetPrincipal(inputs.targetAnnualExpense, inputs.sideIncomeAnnual, inputs.safeWithdrawalRate);
  const estimate = estimateMonthToGoal({
    principal: inputs.principal,
    monthlyContribution: inputs.monthlyContribution,
    annualReturnRatePct: inputs.annualReturnRate,
    targetPrincipal,
    startMonth: inputs.startMonth,
    contributeAtMonthEnd: inputs.contributeAtMonthEnd,
  });

  const progressPct = targetPrincipal <= 0 ? 100 : Math.min((inputs.principal / targetPrincipal) * 100, 100);
  const gap = Math.max(targetPrincipal - inputs.principal, 0);

  let onTrack: boolean | null = null;
  let gapAtTargetMonth: number | null = null;
  let currentPlanAtTargetMonth: number | null = null;

  if (inputs.targetExitMonth) {
    const months = monthDiff(inputs.startMonth, inputs.targetExitMonth);
    if (months >= 0) {
      currentPlanAtTargetMonth = calculateAssetAtMonth({
        principal: inputs.principal,
        monthlyContribution: inputs.monthlyContribution,
        annualReturnRatePct: inputs.annualReturnRate,
        months,
        contributeAtMonthEnd: inputs.contributeAtMonthEnd,
      });
      onTrack = currentPlanAtTargetMonth >= targetPrincipal;
      gapAtTargetMonth = Math.max(targetPrincipal - currentPlanAtTargetMonth, 0);
    }
  }

  return {
    targetPrincipal,
    progressPct,
    gap,
    reachedMonth: estimate.reachedMonth,
    monthsToGoal: estimate.months,
    onTrack,
    gapAtTargetMonth,
    currentPlanAtTargetMonth,
  };
}

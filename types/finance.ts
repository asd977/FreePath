export type ScenarioKey = "conservative" | "neutral" | "optimistic";

export type FinanceInputs = {
  principal: number;
  monthlyContribution: number;
  annualReturnRate: number;
  conservativeRate: number;
  neutralRate: number;
  optimisticRate: number;
  targetAnnualExpense: number;
  sideIncomeAnnual: number;
  safeWithdrawalRate: number;
  startMonth: string;
  targetExitMonth?: string;
  contributeAtMonthEnd: boolean;
};

export type ProjectionPoint = {
  month: string;
  assets: number;
  target: number;
  isCurrent?: boolean;
};

export type ScenarioResult = {
  key: ScenarioKey;
  rate: number;
  monthsToGoal: number | null;
  reachedMonth: string | null;
};

export type PlannerResult = {
  targetPrincipal: number;
  progressPct: number;
  gap: number;
  reachedMonth: string | null;
  monthsToGoal: number | null;
  onTrack: boolean | null;
  gapAtTargetMonth: number | null;
  currentPlanAtTargetMonth: number | null;
};

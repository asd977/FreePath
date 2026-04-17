import { currentMonth } from "@/lib/date";
import { FinanceInputs } from "@/types/finance";
import { QuickPlanOption } from "@/types/plan";

export const DEFAULT_FINANCE_INPUTS: FinanceInputs = {
  principal: 300000,
  monthlyContribution: 10000,
  annualReturnRate: 6,
  conservativeRate: 3,
  neutralRate: 6,
  optimisticRate: 9,
  targetAnnualExpense: 60000,
  sideIncomeAnnual: 12000,
  safeWithdrawalRate: 4,
  startMonth: currentMonth(),
  targetExitMonth: "",
  contributeAtMonthEnd: true,
};

export const QUICK_PLANS: QuickPlanOption[] = [
  { label: "每月存 10,000", monthlyContribution: 10000 },
  { label: "每月存 11,000", monthlyContribution: 11000 },
  { label: "每月存 13,000", monthlyContribution: 13000 },
];

export const STORAGE_KEYS = {
  finance: "freepath.finance.inputs",
  records: "freepath.records.monthly",
  marketCodes: "freepath.market.codes",
};

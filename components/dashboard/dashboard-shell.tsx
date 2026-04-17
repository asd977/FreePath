"use client";

import { useMemo, useState } from "react";
import { DEFAULT_FINANCE_INPUTS } from "@/config/defaults";
import { calculateAdvanceByExtraContribution, calculateScenarioResults, calculateTargetReductionBySideIncome, evaluatePlan, generateProjectionSeries } from "@/lib/finance";
import { storage } from "@/lib/storage";
import { ParameterForm } from "@/components/dashboard/parameter-form";
import { ProgressOverview } from "@/components/dashboard/progress-overview";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { AssetGrowthChart } from "@/components/charts/asset-growth-chart";
import { ScenarioComparisonChart } from "@/components/charts/scenario-comparison-chart";
import { makeExpenseDropTarget, SmartInsights } from "@/components/dashboard/smart-insights";
import { FinanceInputs } from "@/types/finance";

function loadInitialInputs(): FinanceInputs {
  return storage.getFinanceInputs(DEFAULT_FINANCE_INPUTS);
}

export function DashboardShell() {
  const [inputs, setInputs] = useState<FinanceInputs>(loadInitialInputs);

  const result = useMemo(() => evaluatePlan(inputs), [inputs]);
  const projectionData = useMemo(
    () =>
      generateProjectionSeries({
        startMonth: inputs.startMonth,
        months: 120,
        principal: inputs.principal,
        monthlyContribution: inputs.monthlyContribution,
        annualReturnRatePct: inputs.annualReturnRate,
        targetPrincipal: result.targetPrincipal,
        contributeAtMonthEnd: inputs.contributeAtMonthEnd,
      }),
    [inputs, result.targetPrincipal],
  );
  const scenarios = useMemo(() => calculateScenarioResults(inputs, result.targetPrincipal), [inputs, result.targetPrincipal]);

  const advanceMonths = calculateAdvanceByExtraContribution({
    inputs,
    targetPrincipal: result.targetPrincipal,
    extraPerMonth: 1000,
  });
  const sideIncomeReduction = calculateTargetReductionBySideIncome({
    annualExpense: inputs.targetAnnualExpense,
    sideIncomeAnnual: inputs.sideIncomeAnnual,
    safeWithdrawalRate: inputs.safeWithdrawalRate,
    extraSideIncomeAnnual: 10000,
  });

  function handleChange(next: FinanceInputs) {
    setInputs(next);
    storage.setFinanceInputs(next);
  }

  return (
    <div className="space-y-6">
      <ProgressOverview result={result} />
      <SummaryCards result={result} principal={inputs.principal} />
      <ParameterForm defaultValues={inputs} onChange={handleChange} />
      <div className="grid gap-6 xl:grid-cols-2">
        <AssetGrowthChart data={projectionData} />
        <ScenarioComparisonChart scenarios={scenarios} />
      </div>
      <SmartInsights
        reachedMonth={result.reachedMonth}
        monthsEarlierByExtra={advanceMonths}
        targetReductionBySideIncome={sideIncomeReduction}
        expenseDropScenarioTarget={makeExpenseDropTarget(inputs.sideIncomeAnnual, inputs.safeWithdrawalRate)}
      />
    </div>
  );
}

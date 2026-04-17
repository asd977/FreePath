"use client";

import { useMemo, useState } from "react";
import { SectionHeading } from "@/components/common/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CashflowOverviewChart } from "@/components/charts/cashflow-overview-chart";
import { DEFAULT_FINANCE_INPUTS } from "@/config/defaults";
import { calculateScenarioResults, evaluatePlan } from "@/lib/finance";
import { storage } from "@/lib/storage";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { MonthlyRecord } from "@/types/record";

function normalizeRecords(records: MonthlyRecord[]): MonthlyRecord[] {
  return records.map((record) => ({
    ...record,
    type: record.type ?? "deposit",
  }));
}

function SummaryCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-xl font-semibold text-slate-900">{value}</p>
        {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function ScenarioBars({ rows }: { rows: Array<{ label: string; months: number | null }> }) {
  const max = Math.max(...rows.map((d) => d.months ?? 0), 1);

  return (
    <div className="space-y-3">
      {rows.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm text-slate-700">
            <span>{item.label}</span>
            <span>{item.months === null ? "未达成" : `${item.months}个月`}</span>
          </div>
          <div className="h-2 rounded bg-slate-200">
            <div className="h-2 rounded bg-slate-800" style={{ width: `${((item.months ?? 0) / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalysisPage() {
  const [baseInputs] = useState(() => storage.getFinanceInputs(DEFAULT_FINANCE_INPUTS));
  const [records] = useState(() => normalizeRecords(storage.getRecords() as MonthlyRecord[]));

  const analysis = useMemo(() => {
    const plan = evaluatePlan(baseInputs);
    const scenarios = calculateScenarioResults(baseInputs, plan.targetPrincipal).map((item) => ({
      label: `${item.key === "conservative" ? "保守" : item.key === "neutral" ? "中性" : "乐观"}（${item.rate}%）`,
      months: item.monthsToGoal,
    }));

    const monthlyMap = new Map<string, { month: string; deposit: number; expense: number }>();
    records.forEach((item) => {
      const current = monthlyMap.get(item.month) ?? { month: item.month, deposit: 0, expense: 0 };
      if (item.type === "expense") current.expense += item.amount;
      else current.deposit += item.amount;
      monthlyMap.set(item.month, current);
    });
    const monthlySeries = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));
    const last6 = monthlySeries.slice(-6);
    const deposit6 = last6.reduce((sum, item) => sum + item.deposit, 0);
    const expense6 = last6.reduce((sum, item) => sum + item.expense, 0);
    const avgDeposit = last6.length ? deposit6 / last6.length : 0;
    const avgExpense = last6.length ? expense6 / last6.length : 0;
    const avgNet = avgDeposit - avgExpense;
    const savingsRate = avgDeposit <= 0 ? 0 : (avgNet / avgDeposit) * 100;
    const runwayMonths = avgExpense > 0 ? baseInputs.principal / avgExpense : null;

    return { plan, scenarios, monthlySeries, avgDeposit, avgExpense, avgNet, savingsRate, runwayMonths };
  }, [baseInputs, records]);

  return (
    <div className="space-y-6">
      <SectionHeading title="分析页" description="分析当前财务状况、近期收支趋势与目标达成进度。" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="当前资产" value={formatCurrency(baseInputs.principal)} />
        <SummaryCard title="目标资产" value={formatCurrency(analysis.plan.targetPrincipal)} />
        <SummaryCard title="达成进度" value={formatPercent(analysis.plan.progressPct)} />
        <SummaryCard
          title="预计达成时间"
          value={analysis.plan.reachedMonth ?? "未在模拟期内达成"}
          hint={analysis.plan.monthsToGoal === null ? "可提高月存或降低目标支出" : `约 ${analysis.plan.monthsToGoal} 个月`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="近6个月月均存入" value={formatCurrency(analysis.avgDeposit)} />
        <SummaryCard title="近6个月月均支出" value={formatCurrency(analysis.avgExpense)} />
        <SummaryCard title="近6个月月均净额" value={formatCurrency(analysis.avgNet)} />
        <SummaryCard
          title="资金可支撑月数"
          value={analysis.runwayMonths === null ? "暂无支出数据" : `${analysis.runwayMonths.toFixed(1)} 个月`}
          hint={`近6个月储蓄率 ${formatPercent(analysis.savingsRate)}`}
        />
      </div>

      <CashflowOverviewChart data={analysis.monthlySeries} />

      <Card>
        <CardHeader>
          <CardTitle>收益率情景达成时长</CardTitle>
        </CardHeader>
        <CardContent>
          <ScenarioBars rows={analysis.scenarios} />
        </CardContent>
      </Card>
    </div>
  );
}

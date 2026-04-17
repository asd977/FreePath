"use client";

import { useMemo } from "react";
import { SectionHeading } from "@/components/common/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { estimateMonthToGoal } from "@/lib/finance";

function SimpleCompareBars({ data }: { data: Array<{ name: string; months: number }> }) {
  const max = Math.max(...data.map((d) => d.months), 1);

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.name} className="space-y-1">
          <div className="flex items-center justify-between text-sm text-slate-700">
            <span>{item.name}</span>
            <span>{item.months}个月</span>
          </div>
          <div className="h-2 rounded bg-slate-200">
            <div className="h-2 rounded bg-slate-800" style={{ width: `${(item.months / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalysisPage() {
  const comparisonData = useMemo(() => {
    const base = {
      principal: 300000,
      annualReturnRatePct: 6,
      startMonth: "2026-04",
      contributeAtMonthEnd: true,
      targetPrincipal: 1200000,
    };

    const monthlyOptions = [8000, 10000, 12000].map((v) => ({
      name: `月存${v}`,
      months: estimateMonthToGoal({ ...base, monthlyContribution: v }).months ?? 0,
    }));

    const incomeOptions = [0, 10000, 30000].map((sideIncome) => ({
      name: `副业${sideIncome}`,
      months: estimateMonthToGoal({
        ...base,
        monthlyContribution: 10000,
        targetPrincipal: Math.max((60000 - sideIncome) / 0.04, 0),
      }).months ?? 0,
    }));

    return { monthlyOptions, incomeOptions };
  }, []);

  return (
    <div className="space-y-6">
      <SectionHeading title="分析页" description="查看不同变量对目标达成速度的影响。" />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>不同月存金额对比</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleCompareBars data={comparisonData.monthlyOptions} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>不同副业收入对比</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleCompareBars data={comparisonData.incomeOptions} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

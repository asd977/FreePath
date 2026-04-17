"use client";

import { useMemo, useState } from "react";
import { SectionHeading } from "@/components/common/section-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_FINANCE_INPUTS, QUICK_PLANS } from "@/config/defaults";
import { toReadableMonth } from "@/lib/date";
import { estimateMonthToGoal } from "@/lib/finance";
import { storage } from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";

const targets = [1000000, 1250000, 1500000];

export default function PlanPage() {
  const [initialInputs] = useState(() => storage.getFinanceInputs(DEFAULT_FINANCE_INPUTS));
  const [monthlyContribution, setMonthlyContribution] = useState(initialInputs.monthlyContribution);
  const principal = initialInputs.principal;
  const annualReturnRatePct = initialInputs.annualReturnRate;
  const startMonth = initialInputs.startMonth;

  const rows = useMemo(
    () =>
      targets.map((target) => {
        const result = estimateMonthToGoal({
          principal,
          monthlyContribution,
          annualReturnRatePct,
          targetPrincipal: target,
          startMonth,
          contributeAtMonthEnd: true,
        });
        return {
          target,
          month: result.reachedMonth,
          months: result.months,
        };
      }),
    [annualReturnRatePct, monthlyContribution, principal, startMonth],
  );

  return (
    <div className="space-y-6">
      <SectionHeading title="规划页" description="查看公式、切换方案并评估不同目标资产的达成时间。" />
      <Card>
        <CardHeader>
          <CardTitle>快速切换方案</CardTitle>
          <CardDescription>点击方案查看不同月存金额下的达成时间。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {QUICK_PLANS.map((plan) => (
            <Button key={plan.label} variant={monthlyContribution === plan.monthlyContribution ? "default" : "outline"} onClick={() => setMonthlyContribution(plan.monthlyContribution)}>
              {plan.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>公式说明</CardTitle>
          <CardDescription>资产按月复利增长，默认月末追加存入。</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-700">
          资产递推：A(n+1) = A(n) × (1+r/12) + 每月存入。
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {rows.map((item) => (
          <Card key={item.target}>
            <CardHeader>
              <CardDescription>目标资产</CardDescription>
              <CardTitle>{formatCurrency(item.target)}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              {item.month ? `预计达成：${toReadableMonth(item.month)}（约 ${item.months} 个月）` : "未在模拟期内达成"}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

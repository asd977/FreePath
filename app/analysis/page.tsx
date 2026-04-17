"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SectionHeading } from "@/components/common/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { estimateMonthToGoal } from "@/lib/finance";

export default function AnalysisPage() {
  const comparisonData = useMemo(() => {
    const base = { principal: 300000, annualReturnRatePct: 6, startMonth: "2026-04", contributeAtMonthEnd: true, targetPrincipal: 1200000 };

    const monthlyOptions = [8000, 10000, 12000].map((v) => ({
      name: `月存${v}`,
      months: estimateMonthToGoal({ ...base, monthlyContribution: v }).months ?? 0,
    }));

    const incomeOptions = [0, 10000, 30000].map((sideIncome) => ({
      name: `副业${sideIncome}`,
      months: estimateMonthToGoal({ ...base, monthlyContribution: 10000, targetPrincipal: (60000 - sideIncome) / 0.04 }).months ?? 0,
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
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData.monthlyOptions}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v) => `${v ?? 0}个月`} />
                <Bar dataKey="months" fill="#1e293b" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>不同副业收入对比</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData.incomeOptions}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v) => `${v ?? 0}个月`} />
                <Bar dataKey="months" fill="#475569" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

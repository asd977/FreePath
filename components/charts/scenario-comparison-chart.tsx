"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScenarioResult } from "@/types/finance";

const labels: Record<ScenarioResult["key"], string> = {
  conservative: "保守",
  neutral: "中性",
  optimistic: "乐观",
};

export function ScenarioComparisonChart({ scenarios }: { scenarios: ScenarioResult[] }) {
  const data = scenarios.map((item) => ({
    scenario: labels[item.key],
    months: item.monthsToGoal ?? 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>多情景达成时长对比</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="scenario" />
            <YAxis />
            <Tooltip formatter={(v) => `${v ?? 0} 个月`} />
            <Bar dataKey="months" fill="#334155" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

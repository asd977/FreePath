"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScenarioResult } from "@/types/finance";

const labels: Record<ScenarioResult["key"], string> = {
  conservative: "保守",
  neutral: "中性",
  optimistic: "乐观",
};

export function ScenarioComparisonChart({ scenarios }: { scenarios: ScenarioResult[] }) {
  const maxMonths = Math.max(...scenarios.map((s) => s.monthsToGoal ?? 0), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>多情景达成时长对比（轻量版）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {scenarios.map((scenario) => {
          const months = scenario.monthsToGoal ?? 0;
          const width = (months / maxMonths) * 100;
          return (
            <div key={scenario.key} className="space-y-1">
              <div className="flex items-center justify-between text-sm text-slate-700">
                <span>{labels[scenario.key]}</span>
                <span>{months} 个月</span>
              </div>
              <div className="h-2 rounded bg-slate-200">
                <div className="h-2 rounded bg-slate-800" style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

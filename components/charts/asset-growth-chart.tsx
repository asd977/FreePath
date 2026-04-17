"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectionPoint } from "@/types/finance";
import { formatCurrency } from "@/lib/utils";

export function AssetGrowthChart({ data }: { data: ProjectionPoint[] }) {
  const maxValue = Math.max(...data.map((d) => Math.max(d.assets, d.target)), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>资产增长曲线（轻量版）</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.filter((_, idx) => idx % 12 === 0 || idx === data.length - 1).map((point) => {
            const assetPct = Math.min((point.assets / maxValue) * 100, 100);
            const targetPct = Math.min((point.target / maxValue) * 100, 100);
            return (
              <div key={point.month} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>{point.month}</span>
                  <span>{formatCurrency(point.assets)}</span>
                </div>
                <div className="relative h-2 rounded bg-slate-200">
                  <div className="absolute inset-y-0 left-0 rounded bg-slate-900" style={{ width: `${assetPct}%` }} />
                  <div className="absolute inset-y-0 rounded bg-slate-500/60" style={{ left: `${targetPct}%`, width: "2px" }} />
                </div>
              </div>
            );
          })}
          <p className="text-xs text-slate-500">深色条为资产，浅灰竖线为目标资产位置。</p>
        </div>
      </CardContent>
    </Card>
  );
}

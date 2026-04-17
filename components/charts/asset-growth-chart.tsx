"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectionPoint } from "@/types/finance";
import { formatCurrency } from "@/lib/utils";

export function AssetGrowthChart({ data }: { data: ProjectionPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>资产增长曲线</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
            <XAxis dataKey="month" tick={{ fontSize: 12 }} minTickGap={24} />
            <YAxis tickFormatter={(v) => `${Math.round(v / 10000)}w`} tick={{ fontSize: 12 }} width={56} />
            <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
            <ReferenceLine y={data[0]?.target ?? 0} stroke="#64748b" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="assets" stroke="#0f172a" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

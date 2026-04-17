import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { PlannerResult } from "@/types/finance";
import { toReadableMonth } from "@/lib/date";

export function SummaryCards({ result, principal }: { result: PlannerResult; principal: number }) {
  const reachedText = result.reachedMonth ? toReadableMonth(result.reachedMonth) : "未在模拟周期内达成";

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader>
          <CardDescription>当前资产</CardDescription>
          <CardTitle>{formatCurrency(principal)}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>目标资产</CardDescription>
          <CardTitle>{formatCurrency(result.targetPrincipal)}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>还差金额</CardDescription>
          <CardTitle>{formatCurrency(result.gap)}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>预计达成时间</CardDescription>
          <CardTitle className="text-base">{reachedText}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">当前进度：{formatPercent(result.progressPct)}</p>
        </CardContent>
      </Card>
    </div>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toReadableMonth } from "@/lib/date";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { PlannerResult } from "@/types/finance";

export function ProgressOverview({ result }: { result: PlannerResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>总进度概览</CardTitle>
        <CardDescription>帮助你评估何时可以退出全职、走向更自由的生活。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={result.progressPct} />
        <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
          <p>当前进度：{formatPercent(result.progressPct)}</p>
          <p>距离目标还差：{formatCurrency(result.gap)}</p>
          <p>预计达成：{result.reachedMonth ? toReadableMonth(result.reachedMonth) : "未达成"}</p>
          <p>
            目标日期状态：
            {result.onTrack === null ? "未设置目标日期" : result.onTrack ? "可按时实现" : "可能延期"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

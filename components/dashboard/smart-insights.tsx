import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toReadableMonth } from "@/lib/date";
import { calculateTargetPrincipal } from "@/lib/finance";
import { formatCurrency } from "@/lib/utils";

export function SmartInsights({
  reachedMonth,
  monthsEarlierByExtra,
  targetReductionBySideIncome,
  expenseDropScenarioTarget,
}: {
  reachedMonth: string | null;
  monthsEarlierByExtra: number | null;
  targetReductionBySideIncome: number;
  expenseDropScenarioTarget: number;
}) {
  const messages = [
    reachedMonth ? `按当前节奏，你预计将在 ${toReadableMonth(reachedMonth)} 达到目标。` : "按当前参数，模拟周期内未达到目标。",
    monthsEarlierByExtra !== null
      ? `如果每月多存 1,000 元，预计可提前 ${monthsEarlierByExtra} 个月达成。`
      : "每月多存 1,000 元后的提前时间暂不可计算。",
    `如果副业每年多赚 10,000 元，目标本金可下降 ${formatCurrency(targetReductionBySideIncome)}。`,
    `如果年支出降到 40,000 元，目标本金约为 ${formatCurrency(expenseDropScenarioTarget)}。`,
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>智能提示</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-slate-700">
          {messages.map((item) => (
            <li key={item} className="rounded-md bg-slate-50 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function makeExpenseDropTarget(sideIncomeAnnual: number, safeRate: number): number {
  return calculateTargetPrincipal(40000, sideIncomeAnnual, safeRate);
}

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

type CashflowPoint = {
  month: string;
  deposit: number;
  expense: number;
};

export function CashflowOverviewChart({ data }: { data: CashflowPoint[] }) {
  const maxValue = Math.max(...data.map((item) => Math.max(item.deposit, item.expense)), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>月度收支图表（记账视图）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.length === 0 ? (
          <p className="text-sm text-slate-500">暂无图表数据，先添加一条存入或支出记录。</p>
        ) : (
          data.map((item) => {
            const depositWidth = (item.deposit / maxValue) * 100;
            const expenseWidth = (item.expense / maxValue) * 100;
            const net = item.deposit - item.expense;
            return (
              <div key={item.month} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>{item.month}</span>
                  <span>净额 {formatCurrency(net)}</span>
                </div>
                <div className="space-y-1 rounded bg-slate-100 p-2">
                  <div className="h-2 rounded bg-emerald-200">
                    <div className="h-2 rounded bg-emerald-600" style={{ width: `${depositWidth}%` }} />
                  </div>
                  <div className="h-2 rounded bg-rose-200">
                    <div className="h-2 rounded bg-rose-600" style={{ width: `${expenseWidth}%` }} />
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div className="text-xs text-slate-500">绿色=存入，红色=支出。</div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useMemo, useState } from "react";
import { SectionHeading } from "@/components/common/section-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CashflowOverviewChart } from "@/components/charts/cashflow-overview-chart";
import { MonthlyRecordForm } from "@/components/records/monthly-record-form";
import { MonthlyRecordList } from "@/components/records/monthly-record-list";
import { storage } from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";
import { MonthlyRecord } from "@/types/record";

function initialRecords() {
  return storage.getRecords().map((record) => ({
    ...record,
    type: record.type ?? "deposit",
  }));
}

export function RecordsClientPage() {
  const [records, setRecords] = useState<MonthlyRecord[]>(initialRecords);
  const [filter, setFilter] = useState<"all" | "deposit" | "expense">("all");

  const stats = useMemo(() => {
    const totalDeposit = records
      .filter((item) => item.type === "deposit")
      .reduce((sum, item) => sum + item.amount, 0);
    const totalExpense = records
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + item.amount, 0);
    const net = totalDeposit - totalExpense;

    const monthlyMap = new Map<string, { month: string; deposit: number; expense: number }>();
    records.forEach((item) => {
      const current = monthlyMap.get(item.month) ?? { month: item.month, deposit: 0, expense: 0 };
      if (item.type === "expense") {
        current.expense += item.amount;
      } else {
        current.deposit += item.amount;
      }
      monthlyMap.set(item.month, current);
    });

    const monthlySeries = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));

    return {
      months: records.length,
      totalDeposit,
      totalExpense,
      net,
      monthlySeries,
    };
  }, [records]);

  const visibleRecords = useMemo(() => {
    if (filter === "all") return records;
    return records.filter((item) => item.type === filter);
  }, [filter, records]);

  function persist(next: MonthlyRecord[]) {
    setRecords(next);
    storage.setRecords(next);
  }

  return (
    <div className="space-y-6">
      <SectionHeading title="记录页" description="像记账本一样记录存入与支出，自动汇总净现金流。" />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <MonthlyRecordForm
            onSubmit={(values) => {
              const next = [
                {
                  id: crypto.randomUUID(),
                  month: values.month,
                  amount: values.amount,
                  type: values.type,
                  note: values.note,
                  createdAt: new Date().toISOString(),
                },
                ...records,
              ];
              persist(next);
            }}
          />
        </div>
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>收支统计</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 text-sm text-slate-700">
              <p>累计记录月数：{stats.months}</p>
              <p>累计存入：{formatCurrency(stats.totalDeposit)}</p>
              <p>累计支出：{formatCurrency(stats.totalExpense)}</p>
              <p>累计净额：{formatCurrency(stats.net)}</p>
            </CardContent>
          </Card>
          <CashflowOverviewChart data={stats.monthlySeries} />
          <div className="flex items-center gap-2">
            <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
              全部
            </Button>
            <Button
              size="sm"
              variant={filter === "deposit" ? "default" : "outline"}
              onClick={() => setFilter("deposit")}
            >
              仅存入
            </Button>
            <Button
              size="sm"
              variant={filter === "expense" ? "default" : "outline"}
              onClick={() => setFilter("expense")}
            >
              仅支出
            </Button>
          </div>
          <MonthlyRecordList records={visibleRecords} onDelete={(id) => persist(records.filter((item) => item.id !== id))} />
        </div>
      </div>
    </div>
  );
}

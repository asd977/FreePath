"use client";

import { useMemo, useState } from "react";
import { SectionHeading } from "@/components/common/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthlyRecordForm } from "@/components/records/monthly-record-form";
import { MonthlyRecordList } from "@/components/records/monthly-record-list";
import { storage } from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";
import { MonthlyRecord } from "@/types/record";

function initialRecords() {
  return storage.getRecords();
}

export default function RecordsPage() {
  const [records, setRecords] = useState<MonthlyRecord[]>(initialRecords);

  const stats = useMemo(() => {
    const total = records.reduce((sum, item) => sum + item.amount, 0);
    return {
      months: records.length,
      average: records.length === 0 ? 0 : total / records.length,
    };
  }, [records]);

  function persist(next: MonthlyRecord[]) {
    setRecords(next);
    storage.setRecords(next);
  }

  return (
    <div className="space-y-6">
      <SectionHeading title="记录页" description="管理每月存入记录，后续可无缝切换到数据库。" />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <MonthlyRecordForm
            onSubmit={(values) => {
              const next = [
                {
                  id: crypto.randomUUID(),
                  month: values.month,
                  amount: values.amount,
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
              <CardTitle>记录统计</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 text-sm text-slate-700">
              <p>累计记录月数：{stats.months}</p>
              <p>平均每月存入：{formatCurrency(stats.average)}</p>
            </CardContent>
          </Card>
          <MonthlyRecordList records={records} onDelete={(id) => persist(records.filter((item) => item.id !== id))} />
        </div>
      </div>
    </div>
  );
}

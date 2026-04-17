"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { currentMonth } from "@/lib/date";
import { RecordType } from "@/types/record";

type FormValues = {
  month: string;
  amount: number;
  type: RecordType;
  note?: string;
};

export function MonthlyRecordForm({ onSubmit }: { onSubmit: (values: FormValues) => void }) {
  const [values, setValues] = useState<FormValues>({
    month: currentMonth(),
    amount: 0,
    type: "deposit",
    note: "",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>新增月度记录</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!values.month || values.amount < 0) return;
            onSubmit(values);
            setValues({ month: currentMonth(), amount: 0, type: values.type, note: "" });
          }}
        >
          <div className="space-y-2">
            <Label>类型</Label>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-slate-300 focus:ring-2"
              value={values.type}
              onChange={(e) => setValues((prev) => ({ ...prev, type: e.target.value as RecordType }))}
            >
              <option value="deposit">存入</option>
              <option value="expense">支出</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>月份（默认本月）</Label>
            <Input
              type="month"
              value={values.month}
              onChange={(e) => setValues((prev) => ({ ...prev, month: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>{values.type === "expense" ? "当月支出金额" : "当月存入金额"}</Label>
            <Input
              type="number"
              min={0}
              value={values.amount}
              onChange={(e) => setValues((prev) => ({ ...prev, amount: Number(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-2">
            <Label>备注</Label>
            <Textarea
              value={values.note ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="例如：奖金、额外接单收入"
            />
          </div>
          <Button type="submit">添加记录</Button>
        </form>
      </CardContent>
    </Card>
  );
}

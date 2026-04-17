"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type FormValues = {
  month: string;
  amount: number;
  note?: string;
};

export function MonthlyRecordForm({ onSubmit }: { onSubmit: (values: FormValues) => void }) {
  const [values, setValues] = useState<FormValues>({ month: "", amount: 0, note: "" });

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
            setValues({ month: "", amount: 0, note: "" });
          }}
        >
          <div className="space-y-2">
            <Label>月份</Label>
            <Input
              type="month"
              value={values.month}
              onChange={(e) => setValues((prev) => ({ ...prev, month: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>当月存入金额</Label>
            <Input
              type="number"
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

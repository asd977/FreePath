"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FinanceInputs } from "@/types/finance";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function ParameterForm({
  defaultValues,
  onChange,
}: {
  defaultValues: FinanceInputs;
  onChange: (values: FinanceInputs) => void;
}) {
  const [form, setForm] = useState<FinanceInputs>(defaultValues);

  useEffect(() => {
    setForm(defaultValues);
  }, [defaultValues]);

  useEffect(() => {
    onChange(form);
  }, [form, onChange]);

  const setNumber = (key: keyof FinanceInputs, value: string) => {
    const parsed = Number(value);
    setForm((prev) => ({ ...prev, [key]: Number.isFinite(parsed) ? parsed : 0 }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>核心参数输入</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="当前本金">
          <Input type="number" min={0} value={form.principal} onChange={(e) => setNumber("principal", e.target.value)} />
        </Field>
        <Field label="每月存入金额">
          <Input
            type="number"
            min={0}
            value={form.monthlyContribution}
            onChange={(e) => setNumber("monthlyContribution", e.target.value)}
          />
        </Field>
        <Field label="年化收益率(%)">
          <Input
            type="number"
            step="0.1"
            min={-100}
            max={100}
            value={form.annualReturnRate}
            onChange={(e) => setNumber("annualReturnRate", e.target.value)}
          />
        </Field>
        <Field label="保守收益率(%)">
          <Input
            type="number"
            step="0.1"
            min={-100}
            max={100}
            value={form.conservativeRate}
            onChange={(e) => setNumber("conservativeRate", e.target.value)}
          />
        </Field>
        <Field label="中性收益率(%)">
          <Input
            type="number"
            step="0.1"
            min={-100}
            max={100}
            value={form.neutralRate}
            onChange={(e) => setNumber("neutralRate", e.target.value)}
          />
        </Field>
        <Field label="乐观收益率(%)">
          <Input
            type="number"
            step="0.1"
            min={-100}
            max={100}
            value={form.optimisticRate}
            onChange={(e) => setNumber("optimisticRate", e.target.value)}
          />
        </Field>
        <Field label="目标年支出">
          <Input
            type="number"
            min={0}
            value={form.targetAnnualExpense}
            onChange={(e) => setNumber("targetAnnualExpense", e.target.value)}
          />
        </Field>
        <Field label="自由职业/副业年收入">
          <Input
            type="number"
            min={0}
            value={form.sideIncomeAnnual}
            onChange={(e) => setNumber("sideIncomeAnnual", e.target.value)}
          />
        </Field>
        <Field label="安全提取率(%)">
          <Input
            type="number"
            step="0.1"
            min={0.1}
            max={100}
            value={form.safeWithdrawalRate}
            onChange={(e) => setNumber("safeWithdrawalRate", e.target.value)}
          />
        </Field>
        <Field label="开始日期（年月）">
          <Input
            type="month"
            value={form.startMonth}
            onChange={(e) => setForm((prev) => ({ ...prev, startMonth: e.target.value }))}
          />
        </Field>
        <Field label="目标退出全职日期（可选）">
          <Input
            type="month"
            value={form.targetExitMonth ?? ""}
            onChange={(e) => setForm((prev) => ({ ...prev, targetExitMonth: e.target.value }))}
          />
        </Field>
        <div className="space-y-2">
          <Label htmlFor="month-end">按月末存入</Label>
          <div className="flex h-10 items-center">
            <Switch
              id="month-end"
              checked={Boolean(form.contributeAtMonthEnd)}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, contributeAtMonthEnd: checked }))}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FinanceInputs } from "@/types/finance";

const schema = z.object({
  principal: z.number().min(0),
  monthlyContribution: z.number().min(0),
  annualReturnRate: z.number().min(0).max(100),
  conservativeRate: z.number().min(0).max(100),
  neutralRate: z.number().min(0).max(100),
  optimisticRate: z.number().min(0).max(100),
  targetAnnualExpense: z.number().min(0),
  sideIncomeAnnual: z.number().min(0),
  safeWithdrawalRate: z.number().positive().max(100),
  startMonth: z.string().min(1),
  targetExitMonth: z.string().optional(),
  contributeAtMonthEnd: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

const numberReg = { valueAsNumber: true } as const;

export function ParameterForm({ defaultValues, onChange }: { defaultValues: FinanceInputs; onChange: (values: FinanceInputs) => void }) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onChange",
  });

  const watchedValues = useWatch({ control: form.control });

  useEffect(() => {
    const parsed = schema.safeParse(watchedValues);
    if (parsed.success) {
      onChange(parsed.data as FinanceInputs);
    }
  }, [onChange, watchedValues]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>核心参数输入</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="当前本金" error={form.formState.errors.principal?.message}>
          <Input type="number" {...form.register("principal", numberReg)} />
        </Field>
        <Field label="每月存入金额" error={form.formState.errors.monthlyContribution?.message}>
          <Input type="number" {...form.register("monthlyContribution", numberReg)} />
        </Field>
        <Field label="年化收益率(%)" error={form.formState.errors.annualReturnRate?.message}>
          <Input type="number" step="0.1" {...form.register("annualReturnRate", numberReg)} />
        </Field>
        <Field label="保守收益率(%)" error={form.formState.errors.conservativeRate?.message}>
          <Input type="number" step="0.1" {...form.register("conservativeRate", numberReg)} />
        </Field>
        <Field label="中性收益率(%)" error={form.formState.errors.neutralRate?.message}>
          <Input type="number" step="0.1" {...form.register("neutralRate", numberReg)} />
        </Field>
        <Field label="乐观收益率(%)" error={form.formState.errors.optimisticRate?.message}>
          <Input type="number" step="0.1" {...form.register("optimisticRate", numberReg)} />
        </Field>
        <Field label="目标年支出" error={form.formState.errors.targetAnnualExpense?.message}>
          <Input type="number" {...form.register("targetAnnualExpense", numberReg)} />
        </Field>
        <Field label="自由职业/副业年收入" error={form.formState.errors.sideIncomeAnnual?.message}>
          <Input type="number" {...form.register("sideIncomeAnnual", numberReg)} />
        </Field>
        <Field label="安全提取率(%)" error={form.formState.errors.safeWithdrawalRate?.message}>
          <Input type="number" step="0.1" {...form.register("safeWithdrawalRate", numberReg)} />
        </Field>
        <Field label="开始日期（年月）" error={form.formState.errors.startMonth?.message}>
          <Input type="month" {...form.register("startMonth")} />
        </Field>
        <Field label="目标退出全职日期（可选）" error={form.formState.errors.targetExitMonth?.message}>
          <Input type="month" {...form.register("targetExitMonth")} />
        </Field>
        <div className="space-y-2">
          <Label htmlFor="month-end">按月末存入</Label>
          <div className="flex h-10 items-center">
            <Switch
              id="month-end"
              checked={Boolean(watchedValues.contributeAtMonthEnd)}
              onCheckedChange={(checked) => form.setValue("contributeAtMonthEnd", checked, { shouldValidate: true })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

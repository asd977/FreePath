"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  month: z.string().min(1, "请选择月份"),
  amount: z.number().min(0, "请输入有效金额"),
  note: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof schema>;

export function MonthlyRecordForm({ onSubmit }: { onSubmit: (values: FormValues) => void }) {
  const form = useForm<FormValues>({
    defaultValues: { month: "", amount: 0, note: "" },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>新增月度记录</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={form.handleSubmit((values) => {
            const parsed = schema.safeParse(values);
            if (!parsed.success) return;
            onSubmit(parsed.data);
            form.reset({ month: "", amount: 0, note: "" });
          })}
        >
          <div className="space-y-2">
            <Label>月份</Label>
            <Input type="month" {...form.register("month")} />
            {form.formState.errors.month ? <p className="text-xs text-red-600">{form.formState.errors.month.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label>当月存入金额</Label>
            <Input type="number" {...form.register("amount", { valueAsNumber: true })} />
          </div>
          <div className="space-y-2">
            <Label>备注</Label>
            <Textarea {...form.register("note")} placeholder="例如：奖金、额外接单收入" />
          </div>
          <Button type="submit">添加记录</Button>
        </form>
      </CardContent>
    </Card>
  );
}

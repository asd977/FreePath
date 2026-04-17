"use client";

import { useState } from "react";
import { DEFAULT_FINANCE_INPUTS } from "@/config/defaults";
import { SectionHeading } from "@/components/common/section-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { storage } from "@/lib/storage";

export default function SettingsPage() {
  const [message, setMessage] = useState<string>("");

  return (
    <div className="space-y-6">
      <SectionHeading title="设置" description="管理默认参数，清空本地缓存，并预留账号体系接入位置。" />
      <Card>
        <CardHeader>
          <CardTitle>默认参数</CardTitle>
          <CardDescription>
            当前默认值：年化收益率 {DEFAULT_FINANCE_INPUTS.annualReturnRate}% ，安全提取率 {DEFAULT_FINANCE_INPUTS.safeWithdrawalRate}%
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              storage.setFinanceInputs(DEFAULT_FINANCE_INPUTS);
              setMessage("已重置为默认参数。返回首页即可看到效果。");
            }}
          >
            重置默认参数
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              storage.clearAll();
              setMessage("已清空本地数据。后续将支持用户级云端同步。");
            }}
          >
            清空本地数据
          </Button>
        </CardContent>
      </Card>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { SectionHeading } from "@/components/common/section-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { analyzeStock } from "@/lib/stock-analysis";
import { storage } from "@/lib/storage";
import { estimateMonthToGoal } from "@/lib/finance";
import { StockInput } from "@/types/stock";

function SimpleCompareBars({ data }: { data: Array<{ name: string; months: number }> }) {
  const max = Math.max(...data.map((d) => d.months), 1);

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.name} className="space-y-1">
          <div className="flex items-center justify-between text-sm text-slate-700">
            <span>{item.name}</span>
            <span>{item.months}个月</span>
          </div>
          <div className="h-2 rounded bg-slate-200">
            <div className="h-2 rounded bg-slate-800" style={{ width: `${(item.months / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const DEFAULT_STOCK_FORM = {
  code: "",
  name: "",
  currentPrice: 0,
  pe: 0,
  pb: 0,
  pePercentile: 50,
  pbPercentile: 50,
  rsi14: 50,
  macdHist: 0,
  ma20: 0,
  ma60: 0,
  ma120: 0,
  roePct: 10,
  revenueGrowthPct: 8,
  debtToAssetPct: 45,
  dividendYieldPct: 1.5,
  note: "",
};

function initialStocks() {
  return storage.getStocks();
}

export default function AnalysisPage() {
  const [stocks, setStocks] = useState<StockInput[]>(initialStocks);
  const [stockForm, setStockForm] = useState(DEFAULT_STOCK_FORM);

  const comparisonData = useMemo(() => {
    const base = {
      principal: 300000,
      annualReturnRatePct: 6,
      startMonth: "2026-04",
      contributeAtMonthEnd: true,
      targetPrincipal: 1200000,
    };

    const monthlyOptions = [8000, 10000, 12000].map((v) => ({
      name: `月存${v}`,
      months: estimateMonthToGoal({ ...base, monthlyContribution: v }).months ?? 0,
    }));

    const incomeOptions = [0, 10000, 30000].map((sideIncome) => ({
      name: `副业${sideIncome}`,
      months: estimateMonthToGoal({
        ...base,
        monthlyContribution: 10000,
        targetPrincipal: Math.max((60000 - sideIncome) / 0.04, 0),
      }).months ?? 0,
    }));

    return { monthlyOptions, incomeOptions };
  }, []);

  const analyses = useMemo(
    () =>
      stocks.map((stock) => ({
        stock,
        result: analyzeStock(stock),
      })),
    [stocks],
  );

  function persist(next: StockInput[]) {
    setStocks(next);
    storage.setStocks(next);
  }

  return (
    <div className="space-y-6">
      <SectionHeading title="分析页" description="查看不同变量对目标达成速度的影响，并进行股票多因子买卖判断。" />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>不同月存金额对比</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleCompareBars data={comparisonData.monthlyOptions} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>不同副业收入对比</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleCompareBars data={comparisonData.incomeOptions} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>股票分析输入（手动添加编号）</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!stockForm.code.trim()) return;

                const record: StockInput = {
                  id: crypto.randomUUID(),
                  ...stockForm,
                  code: stockForm.code.trim().toUpperCase(),
                  name: stockForm.name.trim() || stockForm.code.trim().toUpperCase(),
                  createdAt: new Date().toISOString(),
                };

                persist([record, ...stocks]);
                setStockForm(DEFAULT_STOCK_FORM);
              }}
            >
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>股票编号</Label>
                  <Input value={stockForm.code} placeholder="AAPL / 600519" onChange={(e) => setStockForm((p) => ({ ...p, code: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>名称</Label>
                  <Input value={stockForm.name} placeholder="可选" onChange={(e) => setStockForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <MetricInput label="现价" value={stockForm.currentPrice} onChange={(v) => setStockForm((p) => ({ ...p, currentPrice: v }))} />
                <MetricInput label="PE" value={stockForm.pe} onChange={(v) => setStockForm((p) => ({ ...p, pe: v }))} />
                <MetricInput label="PB" value={stockForm.pb} onChange={(v) => setStockForm((p) => ({ ...p, pb: v }))} />
                <MetricInput label="股息率%" value={stockForm.dividendYieldPct} onChange={(v) => setStockForm((p) => ({ ...p, dividendYieldPct: v }))} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <MetricInput label="PE历史分位%" value={stockForm.pePercentile} onChange={(v) => setStockForm((p) => ({ ...p, pePercentile: v }))} />
                <MetricInput label="PB历史分位%" value={stockForm.pbPercentile} onChange={(v) => setStockForm((p) => ({ ...p, pbPercentile: v }))} />
                <MetricInput label="MA20" value={stockForm.ma20} onChange={(v) => setStockForm((p) => ({ ...p, ma20: v }))} />
                <MetricInput label="MA60" value={stockForm.ma60} onChange={(v) => setStockForm((p) => ({ ...p, ma60: v }))} />
                <MetricInput label="MA120" value={stockForm.ma120} onChange={(v) => setStockForm((p) => ({ ...p, ma120: v }))} />
                <MetricInput label="RSI14" value={stockForm.rsi14} onChange={(v) => setStockForm((p) => ({ ...p, rsi14: v }))} />
                <MetricInput label="MACD柱" value={stockForm.macdHist} onChange={(v) => setStockForm((p) => ({ ...p, macdHist: v }))} />
                <MetricInput label="ROE%" value={stockForm.roePct} onChange={(v) => setStockForm((p) => ({ ...p, roePct: v }))} />
                <MetricInput label="营收增速%" value={stockForm.revenueGrowthPct} onChange={(v) => setStockForm((p) => ({ ...p, revenueGrowthPct: v }))} />
                <MetricInput label="资产负债率%" value={stockForm.debtToAssetPct} onChange={(v) => setStockForm((p) => ({ ...p, debtToAssetPct: v }))} />
              </div>

              <div className="space-y-1">
                <Label>备注</Label>
                <Textarea value={stockForm.note} onChange={(e) => setStockForm((p) => ({ ...p, note: e.target.value }))} placeholder="比如：行业景气度、政策风险、个人仓位计划" />
              </div>

              <Button type="submit">添加并分析</Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4 xl:col-span-2">
          {analyses.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-slate-600">暂无股票，请先在左侧填写股票编号和指标后添加。</CardContent>
            </Card>
          ) : (
            analyses.map(({ stock, result }) => (
              <Card key={stock.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-2">
                  <div>
                    <CardTitle>
                      {stock.code} · {stock.name}
                    </CardTitle>
                    <p className="mt-1 text-sm text-slate-600">
                      建议：<span className="font-semibold text-slate-900">{result.recommendation}</span>（总分 {result.overallScore} / 100，置信度 {result.confidence}）
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => persist(stocks.filter((s) => s.id !== stock.id))}>
                    删除
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid gap-2 md:grid-cols-2">
                    {result.methods.map((item) => (
                      <div key={item.method} className="rounded-md border border-slate-200 p-3">
                        <p className="font-medium text-slate-900">{item.method}</p>
                        <p className="mt-1 text-slate-700">评分：{item.score}</p>
                        <p className="text-slate-600">{item.summary}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-md bg-emerald-50 p-3">
                      <p className="font-medium text-emerald-800">正向信号</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-emerald-900">
                        {result.keySignals.length === 0 ? <li>暂无明显正向信号</li> : result.keySignals.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                    <div className="rounded-md bg-amber-50 p-3">
                      <p className="font-medium text-amber-800">风险提示</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900">
                        {result.riskWarnings.length === 0 ? <li>暂无突出风险</li> : result.riskWarnings.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  </div>

                  {stock.note ? <p className="rounded-md border border-dashed border-slate-300 p-3 text-slate-600">备注：{stock.note}</p> : null}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MetricInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}

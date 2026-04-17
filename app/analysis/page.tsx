"use client";

import { useMemo, useState } from "react";
import { SectionHeading } from "@/components/common/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CashflowOverviewChart } from "@/components/charts/cashflow-overview-chart";
import { DEFAULT_FINANCE_INPUTS } from "@/config/defaults";
import { calculateScenarioResults, evaluatePlan } from "@/lib/finance";
import { storage } from "@/lib/storage";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { MonthlyRecord } from "@/types/record";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarketAnalysisResponse, MarketRecommendation } from "@/types/market";

function normalizeRecords(records: MonthlyRecord[]): MonthlyRecord[] {
  return records.map((record) => ({
    ...record,
    type: record.type ?? "deposit",
  }));
}

function SummaryCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-xl font-semibold text-slate-900">{value}</p>
        {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function ScenarioBars({ rows }: { rows: Array<{ label: string; months: number | null }> }) {
  const max = Math.max(...rows.map((d) => d.months ?? 0), 1);

  return (
    <div className="space-y-3">
      {rows.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm text-slate-700">
            <span>{item.label}</span>
            <span>{item.months === null ? "未达成" : `${item.months}个月`}</span>
          </div>
          <div className="h-2 rounded bg-slate-200">
            <div className="h-2 rounded bg-slate-800" style={{ width: `${((item.months ?? 0) / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function recommendationLabel(type: MarketRecommendation): { text: string; className: string } {
  if (type === "buy") return { text: "偏买入", className: "bg-emerald-100 text-emerald-700" };
  if (type === "sell") return { text: "偏卖出", className: "bg-rose-100 text-rose-700" };
  return { text: "观望", className: "bg-slate-100 text-slate-700" };
}

function numberOrDash(value: number | null, digits = 2, suffix = "") {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${value.toFixed(digits)}${suffix}`;
}

export default function AnalysisPage() {
  const [baseInputs] = useState(() => storage.getFinanceInputs(DEFAULT_FINANCE_INPUTS));
  const [records] = useState(() => normalizeRecords(storage.getRecords() as MonthlyRecord[]));
  const [marketCodes, setMarketCodes] = useState(() => storage.getMarketCodes().join("\n") || "SH000300\nSH510300\nSZ159915\nSH600519");
  const [marketData, setMarketData] = useState<MarketAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const analysis = useMemo(() => {
    const plan = evaluatePlan(baseInputs);
    const scenarios = calculateScenarioResults(baseInputs, plan.targetPrincipal).map((item) => ({
      label: `${item.key === "conservative" ? "保守" : item.key === "neutral" ? "中性" : "乐观"}（${item.rate}%）`,
      months: item.monthsToGoal,
    }));

    const monthlyMap = new Map<string, { month: string; deposit: number; expense: number }>();
    records.forEach((item) => {
      const current = monthlyMap.get(item.month) ?? { month: item.month, deposit: 0, expense: 0 };
      if (item.type === "expense") current.expense += item.amount;
      else current.deposit += item.amount;
      monthlyMap.set(item.month, current);
    });
    const monthlySeries = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));
    const last6 = monthlySeries.slice(-6);
    const deposit6 = last6.reduce((sum, item) => sum + item.deposit, 0);
    const expense6 = last6.reduce((sum, item) => sum + item.expense, 0);
    const avgDeposit = last6.length ? deposit6 / last6.length : 0;
    const avgExpense = last6.length ? expense6 / last6.length : 0;
    const avgNet = avgDeposit - avgExpense;
    const savingsRate = avgDeposit <= 0 ? 0 : (avgNet / avgDeposit) * 100;
    const runwayMonths = avgExpense > 0 ? baseInputs.principal / avgExpense : null;

    return { plan, scenarios, monthlySeries, avgDeposit, avgExpense, avgNet, savingsRate, runwayMonths };
  }, [baseInputs, records]);

  async function runMarketAnalysis() {
    const codes = marketCodes
      .split(/[\n,，;；\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    storage.setMarketCodes(codes);
    setLoading(true);
    try {
      const res = await fetch("/api/market/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes }),
      });
      const data = (await res.json()) as MarketAnalysisResponse;
      setMarketData(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeading title="分析页" description="分析当前财务状况、近期收支趋势与目标达成进度。" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="当前资产" value={formatCurrency(baseInputs.principal)} />
        <SummaryCard title="目标资产" value={formatCurrency(analysis.plan.targetPrincipal)} />
        <SummaryCard title="达成进度" value={formatPercent(analysis.plan.progressPct)} />
        <SummaryCard
          title="预计达成时间"
          value={analysis.plan.reachedMonth ?? "未在模拟期内达成"}
          hint={analysis.plan.monthsToGoal === null ? "可提高月存或降低目标支出" : `约 ${analysis.plan.monthsToGoal} 个月`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="近6个月月均存入" value={formatCurrency(analysis.avgDeposit)} />
        <SummaryCard title="近6个月月均支出" value={formatCurrency(analysis.avgExpense)} />
        <SummaryCard title="近6个月月均净额" value={formatCurrency(analysis.avgNet)} />
        <SummaryCard
          title="资金可支撑月数"
          value={analysis.runwayMonths === null ? "暂无支出数据" : `${analysis.runwayMonths.toFixed(1)} 个月`}
          hint={`近6个月储蓄率 ${formatPercent(analysis.savingsRate)}`}
        />
      </div>

      <CashflowOverviewChart data={analysis.monthlySeries} />

      <Card>
        <CardHeader>
          <CardTitle>收益率情景达成时长</CardTitle>
        </CardHeader>
        <CardContent>
          <ScenarioBars rows={analysis.scenarios} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>指数 / ETF / 股票分析（新增）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">支持手动输入代码（如 SH000300、SH510300、SZ159915、SH600519），系统会自动抓取免费行情并给出多指标信号。</p>
          <Textarea value={marketCodes} onChange={(e) => setMarketCodes(e.target.value)} className="min-h-28" />
          <Button onClick={runMarketAnalysis} disabled={loading}>
            {loading ? "分析中..." : "获取并分析"}
          </Button>

          {marketData?.failed?.length ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              {marketData.failed.map((item) => (
                <p key={`${item.code}-${item.reason}`}>{item.code}：{item.reason}</p>
              ))}
            </div>
          ) : null}

          <div className="space-y-3">
            {marketData?.items.map((item) => {
              const rec = recommendationLabel(item.recommendation);
              return (
                <div key={`${item.code}-${item.fetchedAt}`} className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-slate-500">{item.code} · {item.name}</p>
                      <p className="text-lg font-semibold text-slate-900">{numberOrDash(item.latestPrice)} ({numberOrDash(item.dayChangePct, 2, "%")})</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${rec.className}`}>{rec.text}（评分 {item.score}）</span>
                  </div>

                  <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-3">
                    <p>MA20 / MA60 / MA120：{numberOrDash(item.indicators.ma20)} / {numberOrDash(item.indicators.ma60)} / {numberOrDash(item.indicators.ma120)}</p>
                    <p>RSI14：{numberOrDash(item.indicators.rsi14)}</p>
                    <p>MACD柱：{numberOrDash(item.indicators.macdHistogram, 3)}</p>
                    <p>布林位置：{numberOrDash(item.indicators.bollingerPosition, 2)}</p>
                    <p>1M / 3M / 6M：{numberOrDash(item.indicators.change1mPct, 2, "%")} / {numberOrDash(item.indicators.change3mPct, 2, "%")} / {numberOrDash(item.indicators.change6mPct, 2, "%")}</p>
                    <p>20日年化波动：{numberOrDash(item.indicators.annualizedVolatility20d, 2, "%")}</p>
                    <p>近1年最大回撤：{numberOrDash(item.indicators.maxDrawdown1yPct, 2, "%")}</p>
                    <p>价格分位(1Y/3Y/5Y)：{numberOrDash(item.indicators.percentile1y, 1, "%")} / {numberOrDash(item.indicators.percentile3y, 1, "%")} / {numberOrDash(item.indicators.percentile5y, 1, "%")}</p>
                    <p>PE(TTM)：{numberOrDash(item.valuation.peTtm)}</p>
                    <p>PB：{numberOrDash(item.valuation.pb)}</p>
                    <p>PE历史分位：{numberOrDash(item.valuation.pePercentile5y, 1, "%")}</p>
                  </div>

                  {item.reasons.length ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                      {item.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  ) : null}
                  {item.valuation.note ? <p className="mt-3 text-xs text-slate-500">说明：{item.valuation.note}</p> : null}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

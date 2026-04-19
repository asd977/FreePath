"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PolymarketSnapshotResponse } from "@/types/polymarket";

type Side = "UP" | "DOWN";

type Position = {
  side: Side;
  qty: number;
  entry: number;
  spent: number;
  openedAt: number;
  entryReason: string;
};

type StrategyState = {
  id: string;
  name: string;
  description: string;
  cash: number;
  realized: number;
  trades: number;
  wins: number;
  losses: number;
  position: Position | null;
  lastAction: string;
  idleTicks: number;
};

type PriceTick = {
  ts: number;
  upMid: number | null;
  downMid: number | null;
  upAsk: number | null;
  downAsk: number | null;
  upBid: number | null;
  downBid: number | null;
  slug: string;
};

const INITIAL_CASH = 10;
const ORDER_SIZE = 1;
const FLAT_BEFORE_SECONDS = 25;
const STORAGE_KEY = "freepath_polymarket_3strategy_v1";

function formatPrice(value: number | null, digits = 3): string {
  if (value === null || !Number.isFinite(value)) return "-";
  return value.toFixed(digits);
}

function formatUnits(value: number): string {
  return value.toFixed(3);
}

function markPrice(side: Side, snapshot: PolymarketSnapshotResponse | null) {
  if (!snapshot) return null;
  const quote = side === "UP" ? snapshot.prices.up : snapshot.prices.down;
  return quote.mid ?? quote.bid ?? quote.ask;
}

function referencePrice(side: Side, snapshot: PolymarketSnapshotResponse | null) {
  return markPrice(side, snapshot);
}

function bestAsk(side: Side, snapshot: PolymarketSnapshotResponse | null) {
  if (!snapshot) return null;
  return side === "UP" ? snapshot.prices.up.ask ?? snapshot.prices.up.mid : snapshot.prices.down.ask ?? snapshot.prices.down.mid;
}

function bestBid(side: Side, snapshot: PolymarketSnapshotResponse | null) {
  if (!snapshot) return null;
  return side === "UP" ? snapshot.prices.up.bid ?? snapshot.prices.up.mid : snapshot.prices.down.bid ?? snapshot.prices.down.mid;
}

function secsLeft(snapshot: PolymarketSnapshotResponse | null) {
  if (!snapshot?.market.endDate) return null;
  return Math.max(0, Math.floor((Date.parse(snapshot.market.endDate) - Date.now()) / 1000));
}

function upDownFromSnapshot(snapshot: PolymarketSnapshotResponse | null) {
  if (!snapshot) return { up: null, down: null };
  return { up: referencePrice("UP", snapshot), down: referencePrice("DOWN", snapshot) };
}

function loadStrategies(): StrategyState[] {
  const defaults: StrategyState[] = [
    {
      id: "flash-drop",
      name: "策略A：急跌抄底",
      description: "8-12秒内塌缩明显才入场，优先抄底跌幅更大的那一边。",
      cash: INITIAL_CASH,
      realized: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      position: null,
      lastAction: "等待塌缩信号",
      idleTicks: 0,
    },
    {
      id: "double-shock",
      name: "策略B：双边塌缩",
      description: "当UP和DOWN同时塌缩时，只买更便宜的一边，偏防守。",
      cash: INITIAL_CASH,
      realized: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      position: null,
      lastAction: "等待双塌缩",
      idleTicks: 0,
    },
    {
      id: "oversold-rebound",
      name: "策略C：超跌回弹",
      description: "先等深度塌缩，再等1-2跳止跌反弹确认后再买。",
      cash: INITIAL_CASH,
      realized: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      position: null,
      lastAction: "等待超跌+止跌",
      idleTicks: 0,
    },
  ];

  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as StrategyState[];
    if (!Array.isArray(parsed) || parsed.length !== defaults.length) return defaults;
    return defaults.map((base, idx) => ({ ...base, ...parsed[idx], id: base.id, name: base.name, description: base.description }));
  } catch {
    return defaults;
  }
}

function pickByLargestDrop(upDrop: number, downDrop: number): Side {
  return upDrop >= downDrop ? "UP" : "DOWN";
}

function historyDrop(history: PriceTick[], side: Side, lookbackTicks: number): number {
  if (history.length <= lookbackTicks) return 0;
  const current = side === "UP" ? history[history.length - 1].upMid : history[history.length - 1].downMid;
  const old = side === "UP" ? history[history.length - 1 - lookbackTicks].upMid : history[history.length - 1 - lookbackTicks].downMid;
  if (current === null || old === null) return 0;
  return old - current;
}

function isMicroRebound(history: PriceTick[], side: Side): boolean {
  if (history.length < 4) return false;
  const a = side === "UP" ? history[history.length - 1].upMid : history[history.length - 1].downMid;
  const b = side === "UP" ? history[history.length - 2].upMid : history[history.length - 2].downMid;
  const c = side === "UP" ? history[history.length - 3].upMid : history[history.length - 3].downMid;
  if (a === null || b === null || c === null) return false;
  return c <= b && a > b;
}

function runEntryRule(strategy: StrategyState, history: PriceTick[], snapshot: PolymarketSnapshotResponse): { side: Side; reason: string } | null {
  if (history.length < 6) return null;

  const upDropFast = historyDrop(history, "UP", 4);
  const downDropFast = historyDrop(history, "DOWN", 4);
  const upDropSlow = historyDrop(history, "UP", 8);
  const downDropSlow = historyDrop(history, "DOWN", 8);
  const current = upDownFromSnapshot(snapshot);

  switch (strategy.id) {
    case "flash-drop": {
      const side = pickByLargestDrop(upDropFast, downDropFast);
      const sideMid = side === "UP" ? current.up : current.down;
      const drop = side === "UP" ? upDropFast : downDropFast;
      if (sideMid !== null && sideMid < 0.53 && sideMid > 0.1 && drop >= 0.03) {
        return { side, reason: `急跌${drop.toFixed(3)}后抄底` };
      }
      return null;
    }
    case "double-shock": {
      const upAsk = bestAsk("UP", snapshot);
      const downAsk = bestAsk("DOWN", snapshot);
      if (
        upAsk !== null &&
        downAsk !== null &&
        upDropFast >= 0.02 &&
        downDropFast >= 0.02 &&
        upAsk + downAsk <= 0.985
      ) {
        const side: Side = upAsk <= downAsk ? "UP" : "DOWN";
        return { side, reason: `双边塌缩，选更便宜${side}` };
      }
      return null;
    }
    case "oversold-rebound": {
      const side = pickByLargestDrop(upDropSlow, downDropSlow);
      const sideMid = side === "UP" ? current.up : current.down;
      const deepDrop = side === "UP" ? upDropSlow : downDropSlow;
      if (sideMid !== null && sideMid < 0.45 && deepDrop >= 0.05 && isMicroRebound(history, side)) {
        return { side, reason: `超跌${deepDrop.toFixed(3)}后止跌回弹` };
      }
      return null;
    }
    default:
      return null;
  }
}

function runFallbackEntryRule(strategy: StrategyState, history: PriceTick[], snapshot: PolymarketSnapshotResponse): { side: Side; reason: string } | null {
  if (strategy.idleTicks < 22 || history.length < 6) return null;
  const upDropFast = historyDrop(history, "UP", 4);
  const downDropFast = historyDrop(history, "DOWN", 4);
  const side = pickByLargestDrop(upDropFast, downDropFast);
  const sideRef = side === "UP" ? referencePrice("UP", snapshot) : referencePrice("DOWN", snapshot);
  const drop = side === "UP" ? upDropFast : downDropFast;
  if (sideRef !== null && sideRef < 0.65 && drop >= 0.008) {
    return { side, reason: `长时间无成交，触发轻塌缩补单(drop=${drop.toFixed(3)})` };
  }
  return null;
}

function maxHoldSeconds(strategyId: string): number {
  if (strategyId === "flash-drop") return 35;
  if (strategyId === "double-shock") return 45;
  return 55;
}

function takeProfit(strategyId: string): number {
  if (strategyId === "flash-drop") return 0.06;
  if (strategyId === "double-shock") return 0.045;
  return 0.07;
}

function stopLoss(strategyId: string): number {
  if (strategyId === "flash-drop") return -0.035;
  if (strategyId === "double-shock") return -0.025;
  return -0.04;
}

export function PolymarketMonitor() {
  const [snapshot, setSnapshot] = useState<PolymarketSnapshotResponse | null>(null);
  const [strategies, setStrategies] = useState<StrategyState[]>(() => loadStrategies());
  const [auto, setAuto] = useState(true);
  const [proxyStatus, setProxyStatus] = useState("连接中...");
  const [logs, setLogs] = useState<string[]>([]);
  const historyRef = useRef<PriceTick[]>([]);

  const pushLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    setLogs((prev) => [`[${time}] ${msg}`, ...prev].slice(0, 200));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(strategies));
  }, [strategies]);

  const refreshSnapshot = useCallback(async (force = false) => {
    try {
      const res = await fetch(`/api/polymarket/snapshot${force ? "?force=1" : ""}`, { cache: "no-store" });
      if (!res.ok) {
        const raw = await res.text();
        throw new Error(`HTTP ${res.status} - ${raw}`);
      }
      const data = (await res.json()) as PolymarketSnapshotResponse;
      setSnapshot(data);
      const proxyHeader = res.headers.get("X-Polymarket-Proxy");
      setProxyStatus(proxyHeader === "enabled" ? "可用（已走代理）" : "可用（未配置代理）");
    } catch (error) {
      setProxyStatus("不可用");
      pushLog(`刷新失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }, [pushLog]);

  useEffect(() => {
    refreshSnapshot(true);
    const timer = window.setInterval(() => {
      refreshSnapshot();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [refreshSnapshot]);

  useEffect(() => {
    if (!snapshot) return;

    historyRef.current = [
      ...historyRef.current,
      {
        ts: Date.now(),
        upMid: referencePrice("UP", snapshot),
        downMid: referencePrice("DOWN", snapshot),
        upAsk: snapshot.prices.up.ask,
        downAsk: snapshot.prices.down.ask,
        upBid: snapshot.prices.up.bid,
        downBid: snapshot.prices.down.bid,
        slug: snapshot.market.slug,
      },
    ].slice(-180);

    if (!auto) return;

    const left = secsLeft(snapshot) ?? 0;

    setStrategies((prev) =>
      prev.map((strategy) => {
        const now = Date.now();

        if (strategy.position) {
          const bid = bestBid(strategy.position.side, snapshot);
          if (bid !== null) {
            const ret = bid / strategy.position.entry - 1;
            const holdSecs = (now - strategy.position.openedAt) / 1000;

            if (
              ret >= takeProfit(strategy.id) ||
              ret <= stopLoss(strategy.id) ||
              holdSecs >= maxHoldSeconds(strategy.id) ||
              left <= FLAT_BEFORE_SECONDS ||
              strategy.position.entry > 0.9 ||
              historyRef.current[historyRef.current.length - 1]?.slug !== historyRef.current[historyRef.current.length - 2]?.slug
            ) {
              const proceeds = bid * strategy.position.qty;
              const pnl = proceeds - strategy.position.spent;
              const win = pnl >= 0;
              pushLog(`${strategy.name} 平仓 ${strategy.position.side} @${bid.toFixed(3)}，P/L ${pnl.toFixed(3)} (${strategy.position.entryReason})`);
              return {
                ...strategy,
                cash: strategy.cash + proceeds,
                realized: strategy.realized + pnl,
                trades: strategy.trades + 1,
                wins: strategy.wins + (win ? 1 : 0),
                losses: strategy.losses + (win ? 0 : 1),
                position: null,
                lastAction: `平仓${strategy.position.side}，本次${pnl >= 0 ? "盈利" : "亏损"}${pnl.toFixed(3)}`,
                idleTicks: 0,
              };
            }
          }
          return strategy;
        }

        if (left <= FLAT_BEFORE_SECONDS + 5 || strategy.cash < ORDER_SIZE) {
          return { ...strategy, lastAction: "等待下一轮或资金恢复", idleTicks: strategy.idleTicks + 1 };
        }

        const entry = runEntryRule(strategy, historyRef.current, snapshot) ?? runFallbackEntryRule(strategy, historyRef.current, snapshot);
        if (!entry) return { ...strategy, idleTicks: strategy.idleTicks + 1 };

        const ask = bestAsk(entry.side, snapshot);
        if (ask === null || ask <= 0 || ask >= 0.98) {
          return { ...strategy, lastAction: "信号出现，但价格不安全", idleTicks: strategy.idleTicks + 1 };
        }

        const qty = ORDER_SIZE / ask;
        pushLog(`${strategy.name} 开仓 ${entry.side} @${ask.toFixed(3)}，投入1，原因：${entry.reason}`);
        return {
          ...strategy,
          cash: strategy.cash - ORDER_SIZE,
          position: {
            side: entry.side,
            qty,
            entry: ask,
            spent: ORDER_SIZE,
            openedAt: now,
            entryReason: entry.reason,
          },
          lastAction: `开仓${entry.side}：${entry.reason}`,
          idleTicks: 0,
        };
      }),
    );
  }, [auto, pushLog, snapshot]);

  const summary = useMemo(() => {
    return strategies.map((s) => {
      const mark = s.position ? markPrice(s.position.side, snapshot) : null;
      const positionValue = s.position && mark !== null ? mark * s.position.qty : 0;
      const unrealized = s.position && mark !== null ? positionValue - s.position.spent : 0;
      const equity = s.cash + positionValue;
      const totalPnl = equity - INITIAL_CASH;
      const winRate = s.trades > 0 ? (s.wins / s.trades) * 100 : 0;
      return { ...s, positionValue, unrealized, equity, totalPnl, winRate };
    });
  }, [snapshot, strategies]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>策略运行状态（全自动）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p>本金：每个策略起始 10；每次固定投入 1（按 Polymarket 份额定价计算：数量 = 1 / 买入价）。</p>
          <p>当前事件：{snapshot?.market.eventTitle ?? "-"}</p>
          <p>当前 slug：{snapshot?.market.slug ?? "-"}</p>
          <p>结算倒计时：<span className="text-lg font-semibold">{secsLeft(snapshot) ?? "-"}s</span></p>
          <p>代理状态：{proxyStatus}</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => refreshSnapshot(true)}>立即刷新</Button>
            <Button variant="outline" onClick={() => setAuto((v) => !v)}>{auto ? "暂停自动策略" : "恢复自动策略"}</Button>
            <Button
              variant="outline"
              onClick={() => {
                historyRef.current = [];
                setStrategies(loadStrategies().map((s) => ({ ...s, cash: INITIAL_CASH, realized: 0, trades: 0, wins: 0, losses: 0, position: null, lastAction: "手动重置", idleTicks: 0 })));
                pushLog("已重置三套策略账户与统计");
              }}
            >
              重置策略
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {summary.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="text-base">{item.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-slate-700">
              <p className="text-xs text-slate-500">{item.description}</p>
              <p>现金：{formatUnits(item.cash)}</p>
              <p>持仓市值：{formatUnits(item.positionValue)}</p>
              <p>未实现：{formatUnits(item.unrealized)}</p>
              <p>总权益：<span className="font-semibold">{formatUnits(item.equity)}</span></p>
              <p>累计收益：<span className={item.totalPnl >= 0 ? "text-emerald-600" : "text-rose-600"}>{formatUnits(item.totalPnl)}</span></p>
              <p>已平仓笔数：{item.trades}（胜率 {item.winRate.toFixed(1)}%）</p>
              <p>当前持仓：{item.position ? `${item.position.side} ${item.position.qty.toFixed(3)}份 @ ${item.position.entry.toFixed(3)}` : "无"}</p>
              <p>最近动作：{item.lastAction}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>实时价格</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2 text-sm">
          <div className="rounded border border-slate-200 p-3">
            <p className="font-semibold">UP</p>
            <p>Bid: {formatPrice(snapshot?.prices.up.bid ?? null)}</p>
            <p>Ask: {formatPrice(snapshot?.prices.up.ask ?? null)}</p>
            <p>Mid: {formatPrice(snapshot?.prices.up.mid ?? null)}</p>
          </div>
          <div className="rounded border border-slate-200 p-3">
            <p className="font-semibold">DOWN</p>
            <p>Bid: {formatPrice(snapshot?.prices.down.bid ?? null)}</p>
            <p>Ask: {formatPrice(snapshot?.prices.down.ask ?? null)}</p>
            <p>Mid: {formatPrice(snapshot?.prices.down.mid ?? null)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>策略日志（持续统计）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 font-mono text-xs text-slate-700">
            {logs.length ? logs.join("\n") : "暂无日志"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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
  lastEntrySlug?: string | null;
};

type PriceTick = {
  ts: number;
  up: number | null;
  down: number | null;
  slug: string;
};

type BtcTick = {
  ts: number;
  chainlink: number | null;
  binance: number | null;
};

const INITIAL_CASH = 10;
const ORDER_SIZE = 1;
const STORAGE_KEY = "freepath_polymarket_5strategy_v4";
const FLAT_BEFORE_SECONDS = 20;
const RANDOM_COOLDOWN_MS = 8_000;

function formatPrice(value: number | null, digits = 3): string {
  if (value === null || !Number.isFinite(value)) return "-";
  return value.toFixed(digits);
}

function formatUnits(value: number): string {
  return value.toFixed(3);
}

function markPrice(side: Side, snapshot: PolymarketSnapshotResponse | null): number | null {
  if (!snapshot) return null;
  const quote = side === "UP" ? snapshot.prices.up : snapshot.prices.down;
  return quote.mid ?? quote.bid ?? quote.ask;
}

function bestAsk(side: Side, snapshot: PolymarketSnapshotResponse | null): number | null {
  if (!snapshot) return null;
  if (side === "UP") return snapshot.prices.up.ask ?? snapshot.prices.up.mid ?? snapshot.prices.up.bid;
  return snapshot.prices.down.ask ?? snapshot.prices.down.mid ?? snapshot.prices.down.bid;
}

function bestBid(side: Side, snapshot: PolymarketSnapshotResponse | null): number | null {
  if (!snapshot) return null;
  if (side === "UP") return snapshot.prices.up.bid ?? snapshot.prices.up.mid ?? snapshot.prices.up.ask;
  return snapshot.prices.down.bid ?? snapshot.prices.down.mid ?? snapshot.prices.down.ask;
}

function slugWindow(slug: string | undefined): { startTs: number; endTs: number } | null {
  if (!slug) return null;
  const matched = slug.match(/btc-updown-5m-(\d{10})/);
  if (!matched) return null;
  const startTs = Number(matched[1]);
  if (!Number.isFinite(startTs)) return null;
  return { startTs, endTs: startTs + 300 };
}

function secsLeft(snapshot: PolymarketSnapshotResponse | null): number | null {
  if (!snapshot) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  const fromSlug = slugWindow(snapshot.market.slug)?.endTs;
  if (fromSlug) return Math.max(0, fromSlug - nowSec);
  return null;
}

function elapsedSecs(snapshot: PolymarketSnapshotResponse | null): number | null {
  if (!snapshot) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  const fromSlug = slugWindow(snapshot.market.slug)?.startTs;
  if (fromSlug) return Math.max(0, nowSec - fromSlug);
  return null;
}

function stddev(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length);
}

function loadStrategies(): StrategyState[] {
  const defaults: StrategyState[] = [
    { id: "value-discount", name: "策略A：折价高概率", description: "高概率且折价时买入", cash: INITIAL_CASH, realized: 0, trades: 0, wins: 0, losses: 0, position: null, lastAction: "等待信号", lastEntrySlug: null },
    { id: "trend-follow", name: "策略B：顺势跟随", description: "短线趋势同向时买入", cash: INITIAL_CASH, realized: 0, trades: 0, wins: 0, losses: 0, position: null, lastAction: "等待信号", lastEntrySlug: null },
    { id: "reversal-defense", name: "策略C：回撤反转", description: "回撤后再转强时买入", cash: INITIAL_CASH, realized: 0, trades: 0, wins: 0, losses: 0, position: null, lastAction: "等待信号", lastEntrySlug: null },
    { id: "anchor-structure-edge", name: "策略D：锚点偏离", description: "Price to Beat + BTC偏离 + 结构过滤", cash: INITIAL_CASH, realized: 0, trades: 0, wins: 0, losses: 0, position: null, lastAction: "等待信号", lastEntrySlug: null },
    { id: "random-test", name: "策略E：随机下注(测试)", description: "每轮随机下注一次用于校验下单流程", cash: INITIAL_CASH, realized: 0, trades: 0, wins: 0, losses: 0, position: null, lastAction: "等待随机测试", lastEntrySlug: null },
  ];

  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as StrategyState[];
    if (!Array.isArray(parsed) || parsed.length !== defaults.length) return defaults;
    return defaults.map((d, i) => ({ ...d, ...parsed[i], id: d.id, name: d.name, description: d.description }));
  } catch {
    return defaults;
  }
}

function entryRule(strategy: StrategyState, snapshot: PolymarketSnapshotResponse, history: PriceTick[], btcTicks: BtcTick[]): { side: Side; reason: string } | null {
  const up = markPrice("UP", snapshot);
  const down = markPrice("DOWN", snapshot);
  const left = secsLeft(snapshot);
  const elapsed = elapsedSecs(snapshot) ?? 999;
  if (left !== null && left <= 25) return null;
  if (elapsed <= 10) return null;
  if (strategy.lastEntrySlug === snapshot.market.slug) return null;

  const dominant: Side | null = up !== null && down !== null ? (up >= down ? "UP" : "DOWN") : null;

  if (strategy.id === "random-test") {
    if (Math.random() < 0.22) {
      return { side: Math.random() < 0.5 ? "UP" : "DOWN", reason: "随机测试下注" };
    }
    return null;
  }

  if (!dominant) return null;
  const ask = bestAsk(dominant, snapshot);
  const prob = dominant === "UP" ? up : down;
  if (ask === null || prob === null) return null;

  if (strategy.id === "value-discount") {
    if (prob >= 0.52 && prob - ask >= 0.005) return { side: dominant, reason: `概率${(prob * 100).toFixed(1)}% 折价${(prob - ask).toFixed(3)}` };
    return null;
  }

  const series = history.map((h) => (dominant === "UP" ? h.up : h.down)).filter((v): v is number => v !== null);
  if (series.length < 6) return null;
  const move5 = series[series.length - 1] - series[series.length - 6];

  if (strategy.id === "trend-follow") {
    if (move5 > 0.004 && prob >= 0.53) return { side: dominant, reason: `短线顺势 move5=${move5.toFixed(3)}` };
    return null;
  }

  if (strategy.id === "reversal-defense") {
    const a = series[series.length - 1];
    const b = series[series.length - 2];
    const c = series[series.length - 3];
    if (b < c && a > b && prob >= 0.54) return { side: dominant, reason: "回撤后反转" };
    return null;
  }

  if (strategy.id === "anchor-structure-edge") {
    const chain = btcTicks.map((t) => t.chainlink).filter((v): v is number => v !== null);
    if (chain.length < 30 || snapshot.market.priceToBeat === null) return null;
    const now = chain[chain.length - 1];
    const delta = now - snapshot.market.priceToBeat;
    const ret = chain.slice(-30).map((v, i, arr) => (i === 0 ? 0 : (v - arr[i - 1]) / arr[i - 1])).slice(1);
    const sigma = Math.max(8, stddev(ret) * snapshot.market.priceToBeat);
    const z = delta / sigma;
    if (Math.abs(delta) >= 12 && Math.abs(z) >= 0.8 && prob - ask >= 0.004) {
      return { side: dominant, reason: `z=${z.toFixed(2)} delta=${delta.toFixed(1)}` };
    }
  }

  return null;
}

function maxHoldSecs(id: string): number {
  if (id === "random-test") return 12;
  if (id === "anchor-structure-edge") return 25;
  return 45;
}

export function PolymarketMonitor() {
  const [snapshot, setSnapshot] = useState<PolymarketSnapshotResponse | null>(null);
  const [strategies, setStrategies] = useState<StrategyState[]>(() => loadStrategies());
  const [auto, setAuto] = useState(true);
  const [proxyStatus, setProxyStatus] = useState("连接中...");
  const [rtdsStatus, setRtdsStatus] = useState("连接中...");
  const [logs, setLogs] = useState<string[]>([]);
  const historyRef = useRef<PriceTick[]>([]);
  const btcRef = useRef<BtcTick[]>([]);
  const randomGateRef = useRef<Record<string, number>>({});

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
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as PolymarketSnapshotResponse;
      setSnapshot(data);
      setProxyStatus(res.headers.get("X-Polymarket-Proxy") === "enabled" ? "可用（已走代理）" : "可用（未配置代理）");
    } catch (e) {
      setProxyStatus("不可用");
      pushLog(`刷新失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }, [pushLog]);

  useEffect(() => {
    refreshSnapshot(true);
    const timer = window.setInterval(() => refreshSnapshot(), 2500);
    return () => window.clearInterval(timer);
  }, [refreshSnapshot]);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch("/api/polymarket/btc", { cache: "no-store" });
        const data = (await res.json()) as { prices?: { chainlink?: number | null; binance?: number | null } };
        btcRef.current = [...btcRef.current, { ts: Date.now(), chainlink: data.prices?.chainlink ?? null, binance: data.prices?.binance ?? null }].slice(-600);
        setRtdsStatus(data.prices?.chainlink !== null && data.prices?.binance !== null ? "RTDS就绪" : "RTDS部分可用");
      } catch {
        setRtdsStatus("RTDS不可用");
      }
    };
    run();
    const timer = window.setInterval(run, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!snapshot || !auto) return;

    historyRef.current = [...historyRef.current, { ts: Date.now(), up: markPrice("UP", snapshot), down: markPrice("DOWN", snapshot), slug: snapshot.market.slug }].slice(-240);

    setStrategies((prev) => prev.map((s) => {
      const now = Date.now();
      const left = secsLeft(snapshot);

      if (s.position) {
        const bid = bestBid(s.position.side, snapshot);
        if (bid === null) return { ...s, lastAction: "持仓中，等待可用Bid" };
        const hold = (now - s.position.openedAt) / 1000;
        const ret = bid / s.position.entry - 1;
        if (ret >= 0.03 || ret <= -0.02 || hold >= maxHoldSecs(s.id) || (left !== null && left <= FLAT_BEFORE_SECONDS)) {
          const proceeds = bid * s.position.qty;
          const pnl = proceeds - s.position.spent;
          const win = pnl >= 0;
          pushLog(`${s.name} 平仓 ${s.position.side} @${bid.toFixed(3)}，P/L ${pnl.toFixed(3)}`);
          return {
            ...s,
            cash: s.cash + proceeds,
            realized: s.realized + pnl,
            trades: s.trades + 1,
            wins: s.wins + (win ? 1 : 0),
            losses: s.losses + (win ? 0 : 1),
            position: null,
            lastAction: `平仓${s.position.side}，${pnl >= 0 ? "盈利" : "亏损"}${pnl.toFixed(3)}`,
          };
        }
        return { ...s, lastAction: "持仓中" };
      }

      if (s.cash < ORDER_SIZE) return { ...s, lastAction: "资金不足" };
      if (left !== null && left <= 25) return { ...s, lastAction: "临近结算，暂停开仓" };

      if (s.id === "random-test") {
        const last = randomGateRef.current[s.id] ?? 0;
        if (now - last < RANDOM_COOLDOWN_MS) return { ...s, lastAction: "随机策略冷却中" };
      }

      const signal = entryRule(s, snapshot, historyRef.current, btcRef.current);
      if (!signal) return { ...s, lastAction: "等待信号" };

      const ask = bestAsk(signal.side, snapshot);
      if (ask === null || ask <= 0 || ask >= 0.99) return { ...s, lastAction: "有信号但报价不可交易" };

      const feeRate = s.id === "anchor-structure-edge" || s.id === "random-test" ? 0.006 : 0;
      const executionPrice = ask * (1 + feeRate);
      const qty = ORDER_SIZE / executionPrice;
      randomGateRef.current[s.id] = now;
      pushLog(`${s.name} 开仓 ${signal.side} @${executionPrice.toFixed(3)}，原因：${signal.reason}`);
      return {
        ...s,
        cash: s.cash - ORDER_SIZE,
        lastEntrySlug: snapshot.market.slug,
        position: {
          side: signal.side,
          qty,
          entry: executionPrice,
          spent: ORDER_SIZE,
          openedAt: now,
          entryReason: signal.reason,
        },
        lastAction: `开仓${signal.side}：${signal.reason}`,
      };
    }));
  }, [auto, pushLog, snapshot]);

  const summary = useMemo(() => strategies.map((s) => {
    const mark = s.position ? markPrice(s.position.side, snapshot) : null;
    const positionValue = s.position && mark !== null ? mark * s.position.qty : 0;
    const unrealized = s.position ? positionValue - s.position.spent : 0;
    const equity = s.cash + positionValue;
    const totalPnl = equity - INITIAL_CASH;
    const winRate = s.trades ? (s.wins / s.trades) * 100 : 0;
    return { ...s, positionValue, unrealized, equity, totalPnl, winRate };
  }), [snapshot, strategies]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>策略运行状态（全自动）</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p>本金：每策略起始 10；每次投入 1（份额 = 1 / 买入价）。</p>
          <p>当前事件：{snapshot?.market.eventTitle ?? "-"}</p>
          <p>当前 slug：{snapshot?.market.slug ?? "-"}</p>
          <p>结算倒计时：<span className="text-lg font-semibold">{secsLeft(snapshot) ?? "-"}s</span></p>
          <p>代理状态：{proxyStatus}；RTDS：{rtdsStatus}</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => refreshSnapshot(true)}>立即刷新</Button>
            <Button variant="outline" onClick={() => setAuto((v) => !v)}>{auto ? "暂停自动策略" : "恢复自动策略"}</Button>
            <Button variant="outline" onClick={() => {
              historyRef.current = [];
              btcRef.current = [];
              randomGateRef.current = {};
              setStrategies(loadStrategies());
              pushLog("已重置策略与历史缓存");
            }}>重置策略</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {summary.map((item) => (
          <Card key={item.id}>
            <CardHeader><CardTitle className="text-base">{item.name}</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm text-slate-700">
              <p className="text-xs text-slate-500">{item.description}</p>
              <p>现金：{formatUnits(item.cash)}</p>
              <p>持仓市值：{formatUnits(item.positionValue)}</p>
              <p>未实现：{formatUnits(item.unrealized)}</p>
              <p>总权益：<span className="font-semibold">{formatUnits(item.equity)}</span></p>
              <p>累计收益：<span className={item.totalPnl >= 0 ? "text-emerald-600" : "text-rose-600"}>{formatUnits(item.totalPnl)}</span></p>
              <p>平仓笔数：{item.trades}（胜率 {item.winRate.toFixed(1)}%）</p>
              <p>当前持仓：{item.position ? `${item.position.side} ${item.position.qty.toFixed(3)}份 @ ${item.position.entry.toFixed(3)}` : "无"}</p>
              <p>最近动作：{item.lastAction}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>实时价格</CardTitle></CardHeader>
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
        <CardHeader><CardTitle>策略日志</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 font-mono text-xs text-slate-700">
            {logs.length ? logs.join("\n") : "暂无日志"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

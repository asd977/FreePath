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
  upMid: number | null;
  downMid: number | null;
  upAsk: number | null;
  downAsk: number | null;
  upBid: number | null;
  downBid: number | null;
  slug: string;
};

type BtcTick = {
  ts: number;
  chainlink: number | null;
  binance: number | null;
};

type Candle5s = {
  open: number;
  high: number;
  low: number;
  close: number;
  startTs: number;
  endTs: number;
};

const INITIAL_CASH = 10;
const ORDER_SIZE = 1;
const FLAT_BEFORE_SECONDS = 25;
const STORAGE_KEY = "freepath_polymarket_4strategy_v3";
const D_STRATEGY_ID = "anchor-structure-edge";
const D_CONFIG = {
  minVolFloor: 8,
  w1: 1.2,
  w2: 0.8,
  w3: 0.6,
  w4: 0.8,
  w5: 1.0,
  breakoutHoldSeconds: 3,
  entryZ: 1.2,
  minAbsDelta: 15,
  maxAsk: 0.72,
  maxSpread: 0.03,
  feeEstimate: 0.006,
  slippageBuffer: 0.004,
  maxWaitFillSeconds: 3,
};
const SIM_TAKER_FEE_RATE = 0.006;
const SIM_MAKER_FEE_RATE = 0;
const SIM_TICK = 0.001;

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
  if (side === "UP") return snapshot.prices.up.ask ?? snapshot.prices.up.mid ?? snapshot.prices.up.bid;
  return snapshot.prices.down.ask ?? snapshot.prices.down.mid ?? snapshot.prices.down.bid;
}

function bestBid(side: Side, snapshot: PolymarketSnapshotResponse | null) {
  if (!snapshot) return null;
  if (side === "UP") return snapshot.prices.up.bid ?? snapshot.prices.up.mid ?? snapshot.prices.up.ask;
  return snapshot.prices.down.bid ?? snapshot.prices.down.mid ?? snapshot.prices.down.ask;
}

function windowFromSlug(slug: string | undefined): { startTs: number; endTs: number } | null {
  if (!slug) return null;
  const matched = slug.match(/btc-updown-5m-(\d{10})/);
  if (!matched) return null;
  const startTs = Number(matched[1]);
  if (!Number.isFinite(startTs)) return null;
  return { startTs, endTs: startTs + 300 };
}

function secsLeft(snapshot: PolymarketSnapshotResponse | null) {
  if (!snapshot) return null;
  const nowMs = Date.now();
  const fromEndDateRaw = snapshot.market.endDate ? Date.parse(snapshot.market.endDate) : NaN;
  const fromEndDate = Number.isFinite(fromEndDateRaw) ? Math.floor((fromEndDateRaw - nowMs) / 1000) : null;
  const window = windowFromSlug(snapshot.market.slug);
  const fromSlug = window ? window.endTs - Math.floor(nowMs / 1000) : null;
  const values = [fromEndDate, fromSlug].filter((v): v is number => v !== null && Number.isFinite(v));
  if (!values.length) return null;
  return Math.max(0, Math.max(...values));
}

function elapsedSecs(snapshot: PolymarketSnapshotResponse | null): number | null {
  if (!snapshot) return null;
  const nowMs = Date.now();
  const fromStartDateRaw = snapshot.market.startDate ? Date.parse(snapshot.market.startDate) : NaN;
  const fromStartDate = Number.isFinite(fromStartDateRaw) ? Math.floor((nowMs - fromStartDateRaw) / 1000) : null;
  const window = windowFromSlug(snapshot.market.slug);
  const fromSlug = window ? Math.floor(nowMs / 1000) - window.startTs : null;
  const values = [fromStartDate, fromSlug].filter((v): v is number => v !== null && Number.isFinite(v));
  if (!values.length) return null;
  const nonNegative = values.filter((v) => v >= 0);
  if (!nonNegative.length) return 0;
  return Math.min(...nonNegative);
}

function upDownFromSnapshot(snapshot: PolymarketSnapshotResponse | null) {
  if (!snapshot) return { up: null, down: null };
  return { up: referencePrice("UP", snapshot), down: referencePrice("DOWN", snapshot) };
}

function loadStrategies(): StrategyState[] {
  const defaults: StrategyState[] = [
    {
      id: "value-discount",
      name: "策略A：高概率折价",
      description: "当某一边概率已经较高（≥60%）且买一价格明显低于参考价时，买入该边。",
      cash: INITIAL_CASH,
      realized: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      position: null,
      lastAction: "等待高概率折价",
    },
    {
      id: "trend-follow",
      name: "策略B：趋势跟随",
      description: "当某一边概率持续抬升且已站上中高概率区间时，顺势跟随。",
      cash: INITIAL_CASH,
      realized: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      position: null,
      lastAction: "等待趋势增强",
    },
    {
      id: "reversal-defense",
      name: "策略C：回撤防守反转",
      description: "高概率边短时回撤后重新转强，再次上行时买入，避免追最高点。",
      cash: INITIAL_CASH,
      realized: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      position: null,
      lastAction: "等待回撤后再转强",
    },
    {
      id: D_STRATEGY_ID,
      name: "策略D：锚点偏离+结构错价",
      description: "融合 Price to Beat 偏离、1秒斜率、5秒K结构、公平概率与盘口质量过滤后再开仓。",
      cash: INITIAL_CASH,
      realized: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      position: null,
      lastAction: "观察期中",
      lastEntrySlug: null,
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

function historyMove(history: PriceTick[], side: Side, lookbackTicks: number): number {
  if (history.length <= lookbackTicks) return 0;
  const current = side === "UP" ? history[history.length - 1].upMid : history[history.length - 1].downMid;
  const old = side === "UP" ? history[history.length - 1 - lookbackTicks].upMid : history[history.length - 1 - lookbackTicks].downMid;
  if (current === null || old === null) return 0;
  return current - old;
}

function historyMovePct(history: PriceTick[], side: Side, lookbackTicks: number): number {
  if (history.length <= lookbackTicks) return 0;
  const current = side === "UP" ? history[history.length - 1].upMid : history[history.length - 1].downMid;
  const old = side === "UP" ? history[history.length - 1 - lookbackTicks].upMid : history[history.length - 1 - lookbackTicks].downMid;
  if (current === null || old === null || old <= 0) return 0;
  return (current - old) / old;
}

function isPullbackThenResume(history: PriceTick[], side: Side): boolean {
  if (history.length < 4) return false;
  const a = side === "UP" ? history[history.length - 1].upMid : history[history.length - 1].downMid;
  const b = side === "UP" ? history[history.length - 2].upMid : history[history.length - 2].downMid;
  const c = side === "UP" ? history[history.length - 3].upMid : history[history.length - 3].downMid;
  if (a === null || b === null || c === null) return false;
  return b < c && a > b;
}

function sideWithHigherProb(snapshot: PolymarketSnapshotResponse): Side | null {
  const up = referencePrice("UP", snapshot);
  const down = referencePrice("DOWN", snapshot);
  if (up === null && down === null) return null;
  if (up !== null && down !== null) return up >= down ? "UP" : "DOWN";
  return up !== null ? "UP" : "DOWN";
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function slopeFromTicks(series: number[], seconds: number): number {
  if (series.length < seconds + 1) return 0;
  const end = series[series.length - 1];
  const start = series[series.length - 1 - seconds];
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return (end - start) / seconds;
}

function stddev(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function build5sCandles(prices: number[], nowTs: number): Candle5s[] {
  const candles: Candle5s[] = [];
  if (prices.length < 5) return candles;
  const points = prices.slice(-60);
  for (let i = 0; i + 5 <= points.length; i += 5) {
    const block = points.slice(i, i + 5);
    candles.push({
      open: block[0],
      high: Math.max(...block),
      low: Math.min(...block),
      close: block[block.length - 1],
      startTs: nowTs - (points.length - i) * 1000,
      endTs: nowTs - (points.length - (i + 5)) * 1000,
    });
  }
  return candles;
}

function longUpperWick(candle: Candle5s): boolean {
  const bodyTop = Math.max(candle.open, candle.close);
  const bodyLen = Math.max(Math.abs(candle.close - candle.open), 0.1);
  return candle.high - bodyTop > bodyLen * 1.4;
}

function longLowerWick(candle: Candle5s): boolean {
  const bodyBottom = Math.min(candle.open, candle.close);
  const bodyLen = Math.max(Math.abs(candle.close - candle.open), 0.1);
  return bodyBottom - candle.low > bodyLen * 1.4;
}

function runEntryRule(
  strategy: StrategyState,
  history: PriceTick[],
  snapshot: PolymarketSnapshotResponse,
  btcTicks: BtcTick[],
): { side: Side; reason: string } | null {
  if (history.length < 6) return null;

  const upMoveFast = historyMove(history, "UP", 4);
  const downMoveFast = historyMove(history, "DOWN", 4);
  const upMoveSlow = historyMove(history, "UP", 8);
  const downMoveSlow = historyMove(history, "DOWN", 8);
  const upMoveFastPct = historyMovePct(history, "UP", 4);
  const downMoveFastPct = historyMovePct(history, "DOWN", 4);
  const upMoveSlowPct = historyMovePct(history, "UP", 8);
  const downMoveSlowPct = historyMovePct(history, "DOWN", 8);
  const current = upDownFromSnapshot(snapshot);
  const dominantSide = sideWithHigherProb(snapshot);

  switch (strategy.id) {
    case "value-discount": {
      if (!dominantSide) return null;
      const side = dominantSide;
      const sideMid = side === "UP" ? current.up : current.down;
      const sideAsk = bestAsk(side, snapshot);
      if (sideMid === null || sideAsk === null || sideAsk <= 0) return null;
      const discount = sideMid - sideAsk;
      if (sideMid >= 0.55 && sideMid <= 0.92 && discount >= 0.008) {
        return { side, reason: `高概率${(sideMid * 100).toFixed(1)}%且折价${discount.toFixed(3)}` };
      }
      return null;
    }
    case "trend-follow": {
      if (!dominantSide) return null;
      const side = dominantSide;
      const sideMid = side === "UP" ? current.up : current.down;
      const fastMove = side === "UP" ? upMoveFast : downMoveFast;
      const fastMovePct = side === "UP" ? upMoveFastPct : downMoveFastPct;
      const slowMove = side === "UP" ? upMoveSlow : downMoveSlow;
      const ask = bestAsk(side, snapshot);
      if (sideMid !== null && ask !== null && sideMid >= 0.54 && sideMid <= 0.9 && fastMove >= 0.004 && fastMovePct >= 0.008 && slowMove > 0) {
        return { side, reason: `趋势上行${fastMove.toFixed(3)}，概率${(sideMid * 100).toFixed(1)}%` };
      }
      return null;
    }
    case "reversal-defense": {
      if (!dominantSide) return null;
      const side = dominantSide;
      const sideMid = side === "UP" ? current.up : current.down;
      const fastMove = side === "UP" ? upMoveFast : downMoveFast;
      const fastMovePct = side === "UP" ? upMoveFastPct : downMoveFastPct;
      const slowMovePct = side === "UP" ? upMoveSlowPct : downMoveSlowPct;
      if (
        sideMid !== null &&
        sideMid >= 0.58 &&
        sideMid <= 0.92 &&
        slowMovePct > -0.005 &&
        fastMove > 0 &&
        (isPullbackThenResume(history, side) || fastMovePct > 0.01)
      ) {
        return { side, reason: `回撤后再转强，当前概率${(sideMid * 100).toFixed(1)}%` };
      }
      return null;
    }
    case D_STRATEGY_ID: {
      const now = Date.now();
      const elapsed = elapsedSecs(snapshot) ?? 0;
      const left = secsLeft(snapshot) ?? 0;
      if (elapsed <= 30) return null;
      if (elapsed > 210 || left < 45) return null;
      if (strategy.lastEntrySlug === snapshot.market.slug) return null;
      const chainSeries = btcTicks.map((t) => t.chainlink).filter((v): v is number => v !== null);
      const binanceSeries = btcTicks.map((t) => t.binance).filter((v): v is number => v !== null);
      if (chainSeries.length < 45 || binanceSeries.length < 45) return null;

      const chain = chainSeries[chainSeries.length - 1];
      const binance = binanceSeries[binanceSeries.length - 1];
      const priceToBeat = snapshot.market.priceToBeat;
      if (priceToBeat === null || priceToBeat <= 0) return null;
      const delta = chain - priceToBeat;
      const absDelta = Math.abs(delta);
      const recent30 = chainSeries.slice(-31);
      const returns30 = recent30.slice(1).map((v, i) => (v - recent30[i]) / recent30[i]);
      const sigma30 = stddev(returns30) * priceToBeat;
      const z = delta / Math.max(sigma30, D_CONFIG.minVolFloor);

      const slope10 = slopeFromTicks(chainSeries, 10);
      const slope20 = slopeFromTicks(chainSeries, 20);
      const slope40 = slopeFromTicks(chainSeries, 40);
      const candles = build5sCandles(chainSeries, now);
      if (candles.length < 6) return null;
      const recent3 = candles.slice(-3);
      const recent2 = candles.slice(-2);
      const bullish3 = recent3.filter((c) => c.close > c.open).length;
      const bearish3 = recent3.filter((c) => c.close < c.open).length;
      const noLongUpper = recent2.every((c) => !longUpperWick(c));
      const noLongLower = recent2.every((c) => !longLowerWick(c));
      const prev30 = chainSeries.slice(-31, -1);
      if (!prev30.length) return null;
      const recent30High = Math.max(...prev30);
      const recent30Low = Math.min(...prev30);
      const breakoutUp = chain > recent30High && chainSeries.slice(-D_CONFIG.breakoutHoldSeconds).every((v) => v >= recent30High);
      const breakoutDown = chain < recent30Low && chainSeries.slice(-D_CONFIG.breakoutHoldSeconds).every((v) => v <= recent30Low);
      const divergence = Math.abs(chain - binance);
      const reversalRisk = (noLongUpper ? 0 : 0.8) + (divergence > 12 ? 1 : 0);
      const breakoutScore = breakoutUp ? 1 : breakoutDown ? -1 : 0;
      const scoreUp =
        D_CONFIG.w1 * z +
        D_CONFIG.w2 * slope20 +
        D_CONFIG.w3 * slope40 +
        D_CONFIG.w4 * breakoutScore -
        D_CONFIG.w5 * reversalRisk;
      const fairPUp = sigmoid(scoreUp);
      const fairPDown = 1 - fairPUp;

      const askUp = bestAsk("UP", snapshot);
      const askDown = bestAsk("DOWN", snapshot);
      const spreadUp = snapshot.prices.up.spread ?? 1;
      const spreadDown = snapshot.prices.down.spread ?? 1;
      const depthUp = snapshot.prices.up.topDepth ?? 0;
      const depthDown = snapshot.prices.down.topDepth ?? 0;
      const entryEdgeUp = Math.max(0.03, D_CONFIG.feeEstimate + spreadUp + 0.01);
      const entryEdgeDown = Math.max(0.03, D_CONFIG.feeEstimate + spreadDown + 0.01);
      const effectiveUp = (askUp ?? 1) + D_CONFIG.feeEstimate + D_CONFIG.slippageBuffer;
      const effectiveDown = (askDown ?? 1) + D_CONFIG.feeEstimate + D_CONFIG.slippageBuffer;

      if (
        z >= D_CONFIG.entryZ &&
        absDelta >= D_CONFIG.minAbsDelta &&
        slope10 > 0 &&
        slope20 > 0 &&
        slope40 > 0 &&
        bullish3 >= 2 &&
        noLongUpper &&
        (breakoutUp || (slope20 > 0.8 && fairPUp > 0.66)) &&
        askUp !== null &&
        askUp <= D_CONFIG.maxAsk &&
        spreadUp <= D_CONFIG.maxSpread &&
        depthUp >= ORDER_SIZE * 3 &&
        fairPUp - effectiveUp >= entryEdgeUp
      ) {
        return {
          side: "UP",
          reason: `D策略: z=${z.toFixed(2)}, fair=${fairPUp.toFixed(3)}, slope20=${slope20.toFixed(2)}, slope40=${slope40.toFixed(2)}`,
        };
      }

      if (
        z <= -D_CONFIG.entryZ &&
        absDelta >= D_CONFIG.minAbsDelta &&
        slope10 < 0 &&
        slope20 < 0 &&
        slope40 < 0 &&
        bearish3 >= 2 &&
        noLongLower &&
        (breakoutDown || (slope20 < -0.8 && fairPDown > 0.66)) &&
        askDown !== null &&
        askDown <= D_CONFIG.maxAsk &&
        spreadDown <= D_CONFIG.maxSpread &&
        depthDown >= ORDER_SIZE * 3 &&
        fairPDown - effectiveDown >= entryEdgeDown
      ) {
        return {
          side: "DOWN",
          reason: `D策略: z=${z.toFixed(2)}, fair=${fairPDown.toFixed(3)}, slope20=${slope20.toFixed(2)}, slope40=${slope40.toFixed(2)}`,
        };
      }
      return null;
    }
    default:
      return null;
  }
}

function maxHoldSeconds(strategyId: string): number {
  if (strategyId === D_STRATEGY_ID) return 25;
  if (strategyId === "value-discount") return 50;
  if (strategyId === "trend-follow") return 60;
  return 70;
}

function takeProfit(strategyId: string): number {
  if (strategyId === D_STRATEGY_ID) return 0.03;
  if (strategyId === "value-discount") return 0.04;
  if (strategyId === "trend-follow") return 0.05;
  return 0.055;
}

function stopLoss(strategyId: string): number {
  if (strategyId === D_STRATEGY_ID) return -0.02;
  if (strategyId === "value-discount") return -0.025;
  if (strategyId === "trend-follow") return -0.03;
  return -0.028;
}

function simulateEntryFill(strategyId: string, side: Side, snapshot: PolymarketSnapshotResponse): { fillPrice: number; feeRate: number; mode: "maker" | "taker" } | null {
  const ask = bestAsk(side, snapshot);
  const bid = bestBid(side, snapshot);
  if (ask === null || ask <= 0) return null;

  const makerLimit = bid !== null ? bid + SIM_TICK : null;
  if (makerLimit !== null && makerLimit >= ask - SIM_TICK) {
    return { fillPrice: Math.min(makerLimit, ask), feeRate: SIM_MAKER_FEE_RATE, mode: "maker" };
  }

  const spread = side === "UP" ? snapshot.prices.up.spread ?? null : snapshot.prices.down.spread ?? null;
  if (strategyId === D_STRATEGY_ID) {
    if (spread !== null && spread <= D_CONFIG.maxSpread) {
      return { fillPrice: ask, feeRate: SIM_TAKER_FEE_RATE, mode: "taker" };
    }
    return null;
  }

  if (spread !== null && spread <= 0.05) {
    return { fillPrice: ask, feeRate: SIM_TAKER_FEE_RATE, mode: "taker" };
  }
  return null;
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

  const refreshBtc = useCallback(async () => {
    try {
      const res = await fetch("/api/polymarket/btc", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { prices?: { chainlink?: number | null; binance?: number | null } };
      const chainlink = data.prices?.chainlink ?? null;
      const binance = data.prices?.binance ?? null;
      btcRef.current = [...btcRef.current, { ts: Date.now(), chainlink, binance }].slice(-600);
      setRtdsStatus(chainlink !== null && binance !== null ? "RTDS就绪" : "RTDS部分可用");
    } catch {
      setRtdsStatus("RTDS不可用");
    }
  }, []);

  useEffect(() => {
    refreshBtc();
    const timer = window.setInterval(() => {
      refreshBtc();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [refreshBtc]);

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
            let dExit = false;
            if (strategy.id === D_STRATEGY_ID) {
              const chainSeries = btcRef.current.map((t) => t.chainlink).filter((v): v is number => v !== null);
              const priceToBeat = snapshot.market.priceToBeat;
              if (priceToBeat !== null && chainSeries.length >= 31) {
                const chain = chainSeries[chainSeries.length - 1];
                const recent30 = chainSeries.slice(-31);
                const returns30 = recent30.slice(1).map((v, i) => (v - recent30[i]) / recent30[i]);
                const sigma30 = stddev(returns30) * priceToBeat;
                const z = (chain - priceToBeat) / Math.max(sigma30, D_CONFIG.minVolFloor);
                const shortSlope = slopeFromTicks(chainSeries, 10);
                const directionInvalid =
                  (strategy.position.side === "UP" && z < 0.3 && shortSlope < 0) ||
                  (strategy.position.side === "DOWN" && z > -0.3 && shortSlope > 0);
                dExit = directionInvalid || (holdSecs >= 10 && ret <= 0) || left <= 25;
              } else {
                dExit = left <= 25;
              }
            }

            if (
              ret >= takeProfit(strategy.id) ||
              ret <= stopLoss(strategy.id) ||
              holdSecs >= maxHoldSeconds(strategy.id) ||
              left <= FLAT_BEFORE_SECONDS ||
              dExit ||
              strategy.position.entry > 0.92 ||
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
              };
            }
          }
          return strategy;
        }

        if (left <= FLAT_BEFORE_SECONDS + 5 || strategy.cash < ORDER_SIZE) {
          return { ...strategy, lastAction: "等待下一轮或资金恢复" };
        }

        const entry = runEntryRule(strategy, historyRef.current, snapshot, btcRef.current);
        if (!entry) return strategy;

        const ask = bestAsk(entry.side, snapshot);
        const maxSafeAsk = strategy.id === D_STRATEGY_ID ? 0.9 : 0.985;
        if (ask === null || ask <= 0 || ask >= maxSafeAsk) {
          return { ...strategy, lastAction: "信号出现，但价格不安全" };
        }

        const fill = simulateEntryFill(strategy.id, entry.side, snapshot);
        if (!fill) {
          return { ...strategy, lastAction: "信号出现，但模拟挂单未成交（流动性不足）" };
        }
        const executionPrice = fill.fillPrice * (1 + fill.feeRate);
        const qty = ORDER_SIZE / executionPrice;
        pushLog(
          `${strategy.name} 开仓 ${entry.side} @${executionPrice.toFixed(3)}，投入1，原因：${entry.reason}（${fill.mode}模拟${fill.feeRate > 0 ? `+fee ${(fill.feeRate * 100).toFixed(2)}%` : ""}）`,
        );
        return {
          ...strategy,
          cash: strategy.cash - ORDER_SIZE,
          lastEntrySlug: strategy.id === D_STRATEGY_ID ? snapshot.market.slug : strategy.lastEntrySlug ?? null,
          position: {
            side: entry.side,
            qty,
            entry: executionPrice,
            spent: ORDER_SIZE,
            openedAt: now,
            entryReason: entry.reason,
          },
          lastAction: `开仓${entry.side}：${entry.reason}`,
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
          <p>新版逻辑：不再限定“塌缩”，改为围绕高概率边做折价、趋势、回撤三类入场。</p>
          <p>当前事件：{snapshot?.market.eventTitle ?? "-"}</p>
          <p>Price to Beat：{snapshot?.market.priceToBeat ? snapshot.market.priceToBeat.toFixed(2) : "-"}</p>
          <p>当前 slug：{snapshot?.market.slug ?? "-"}</p>
          <p>结算倒计时：<span className="text-lg font-semibold">{secsLeft(snapshot) ?? "-"}s</span></p>
          <p>代理状态：{proxyStatus}</p>
          <p>RTDS状态：{rtdsStatus}</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => refreshSnapshot(true)}>立即刷新</Button>
            <Button variant="outline" onClick={() => setAuto((v) => !v)}>{auto ? "暂停自动策略" : "恢复自动策略"}</Button>
            <Button
              variant="outline"
              onClick={() => {
                historyRef.current = [];
                setStrategies(loadStrategies().map((s) => ({ ...s, cash: INITIAL_CASH, realized: 0, trades: 0, wins: 0, losses: 0, position: null, lastAction: "手动重置" })));
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
            <p>Spread: {formatPrice(snapshot?.prices.up.spread ?? null)}</p>
            <p>TopDepth: {formatPrice(snapshot?.prices.up.topDepth ?? null)}</p>
          </div>
          <div className="rounded border border-slate-200 p-3">
            <p className="font-semibold">DOWN</p>
            <p>Bid: {formatPrice(snapshot?.prices.down.bid ?? null)}</p>
            <p>Ask: {formatPrice(snapshot?.prices.down.ask ?? null)}</p>
            <p>Mid: {formatPrice(snapshot?.prices.down.mid ?? null)}</p>
            <p>Spread: {formatPrice(snapshot?.prices.down.spread ?? null)}</p>
            <p>TopDepth: {formatPrice(snapshot?.prices.down.topDepth ?? null)}</p>
          </div>
          <div className="rounded border border-slate-200 p-3 md:col-span-2">
            <p className="font-semibold">Recent Trade (market channel fallback)</p>
            <p>Price: {formatPrice(snapshot?.recentTrade.price ?? null)}</p>
            <p>Side: {snapshot?.recentTrade.side ?? "-"}</p>
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

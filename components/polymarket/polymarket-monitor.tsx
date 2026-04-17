"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PolymarketSnapshotResponse } from "@/types/polymarket";

type Position = { qty: number; avg: number };
type AccountState = {
  cash: number;
  realized: number;
  positions: {
    UP: Position;
    DOWN: Position;
  };
};

const STORAGE_KEY = "freepath_polymarket_account_v1";

function formatPrice(value: number | null, digits = 3): string {
  if (value === null || !Number.isFinite(value)) return "-";
  return value.toFixed(digits);
}

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

function markPrice(side: "UP" | "DOWN", snapshot: PolymarketSnapshotResponse | null) {
  if (!snapshot) return null;
  const quote = side === "UP" ? snapshot.prices.up : snapshot.prices.down;
  return quote.mid ?? quote.bid ?? quote.ask;
}

function secsLeft(snapshot: PolymarketSnapshotResponse | null) {
  if (!snapshot?.market.endDate) return null;
  return Math.max(0, Math.floor((Date.parse(snapshot.market.endDate) - Date.now()) / 1000));
}

function loadAccount(): AccountState {
  if (typeof window === "undefined") {
    return { cash: 1000, realized: 0, positions: { UP: { qty: 0, avg: 0 }, DOWN: { qty: 0, avg: 0 } } };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as AccountState;
    if (typeof parsed.cash === "number" && typeof parsed.realized === "number") {
      return parsed;
    }
  } catch {
    // noop
  }

  return { cash: 1000, realized: 0, positions: { UP: { qty: 0, avg: 0 }, DOWN: { qty: 0, avg: 0 } } };
}

export function PolymarketMonitor() {
  const [snapshot, setSnapshot] = useState<PolymarketSnapshotResponse | null>(null);
  const [account, setAccount] = useState<AccountState>(() => loadAccount());
  const [tradeUsd, setTradeUsd] = useState(25);
  const [slip, setSlip] = useState(0.01);
  const [threshold, setThreshold] = useState(0.03);
  const [flatBefore, setFlatBefore] = useState(25);
  const [auto, setAuto] = useState(false);
  const [proxyStatus, setProxyStatus] = useState("连接中...");
  const [logs, setLogs] = useState<string[]>([]);

  const pushLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    setLogs((prev) => [`[${time}] ${msg}`, ...prev].slice(0, 120));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
  }, [account]);

  const refreshSnapshot = useCallback(async (force = false) => {
    try {
      const res = await fetch(`/api/polymarket/snapshot${force ? "?force=1" : ""}`, { cache: "no-store" });
      if (!res.ok) {
        let detail = "";
        try {
          const body = (await res.json()) as { error?: string };
          detail = body?.error ? ` - ${body.error}` : "";
        } catch {
          // noop
        }
        throw new Error(`HTTP ${res.status}${detail}`);
      }
      const data = (await res.json()) as PolymarketSnapshotResponse;
      setSnapshot(data);
      setProxyStatus("可用");
    } catch (error) {
      setProxyStatus("不可用");
      pushLog(`刷新失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }, [pushLog]);

  const inventoryValue = useMemo(() => {
    const up = (markPrice("UP", snapshot) ?? 0) * account.positions.UP.qty;
    const down = (markPrice("DOWN", snapshot) ?? 0) * account.positions.DOWN.qty;
    return up + down;
  }, [account.positions.DOWN.qty, account.positions.UP.qty, snapshot]);

  const unrealized = useMemo(() => {
    const upMark = markPrice("UP", snapshot);
    const downMark = markPrice("DOWN", snapshot);

    let value = 0;
    if (upMark !== null && account.positions.UP.qty > 0) {
      value += (upMark - account.positions.UP.avg) * account.positions.UP.qty;
    }
    if (downMark !== null && account.positions.DOWN.qty > 0) {
      value += (downMark - account.positions.DOWN.avg) * account.positions.DOWN.qty;
    }
    return value;
  }, [account.positions.DOWN, account.positions.UP, snapshot]);

  const buySide = useCallback(
    (side: "UP" | "DOWN") => {
      if (!snapshot) return;
      const quote = side === "UP" ? snapshot.prices.up : snapshot.prices.down;
      const ask = quote.ask ?? quote.mid;
      if (!ask) return pushLog(`买入 ${side} 失败：没有 ask`);
      if (tradeUsd > account.cash) return pushLog(`买入 ${side} 失败：现金不足`);

      const px = Math.min(0.999, ask + slip);
      const qty = tradeUsd / px;
      setAccount((prev) => {
        const current = prev.positions[side];
        const nextQty = current.qty + qty;
        const avg = nextQty > 0 ? (current.avg * current.qty + qty * px) / nextQty : 0;
        return {
          ...prev,
          cash: prev.cash - tradeUsd,
          positions: {
            ...prev.positions,
            [side]: { qty: nextQty, avg },
          },
        };
      });
      pushLog(`买入 ${side}: ${formatMoney(tradeUsd)} @ ${px.toFixed(3)} -> ${qty.toFixed(4)} 股`);
    },
    [account.cash, pushLog, slip, snapshot, tradeUsd],
  );

  const sellAll = useCallback(
    (side: "UP" | "DOWN") => {
      if (!snapshot) return;
      const quote = side === "UP" ? snapshot.prices.up : snapshot.prices.down;
      const bid = quote.bid ?? quote.mid;
      const pos = account.positions[side];

      if (pos.qty <= 0) return pushLog(`卖出 ${side}：无持仓`);
      if (!bid) return pushLog(`卖出 ${side} 失败：没有 bid`);

      const proceeds = bid * pos.qty;
      const pnl = (bid - pos.avg) * pos.qty;

      setAccount((prev) => ({
        ...prev,
        cash: prev.cash + proceeds,
        realized: prev.realized + pnl,
        positions: {
          ...prev.positions,
          [side]: { qty: 0, avg: 0 },
        },
      }));
      pushLog(`卖出 ${side}: ${pos.qty.toFixed(4)} 股 @ ${bid.toFixed(3)}，实现盈亏 ${formatMoney(pnl)}`);
    },
    [account.positions, pushLog, snapshot],
  );

  useEffect(() => {
    refreshSnapshot(true);
    const timer = window.setInterval(() => {
      refreshSnapshot();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [refreshSnapshot]);

  useEffect(() => {
    if (!auto || !snapshot) return;
    const left = secsLeft(snapshot);
    if (left !== null && left <= flatBefore) {
      if (account.positions.UP.qty > 0) sellAll("UP");
      if (account.positions.DOWN.qty > 0) sellAll("DOWN");
      return;
    }

    const upMid = snapshot.prices.up.mid;
    const downMid = snapshot.prices.down.mid;
    if (upMid !== null && upMid > 0.5 + threshold && account.positions.UP.qty <= 0) buySide("UP");
    if (downMid !== null && downMid > 0.5 + threshold && account.positions.DOWN.qty <= 0) buySide("DOWN");
  }, [account.positions.DOWN.qty, account.positions.UP.qty, auto, buySide, flatBefore, sellAll, snapshot, threshold]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>市场状态</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p>当前事件：{snapshot?.market.eventTitle ?? "-"}</p>
            <p>当前 slug：{snapshot?.market.slug ?? "-"}</p>
            <p>开始时间：{snapshot ? new Date(snapshot.market.startDate).toLocaleString("zh-CN") : "-"}</p>
            <p>结算时间：{snapshot ? new Date(snapshot.market.endDate).toLocaleString("zh-CN") : "-"}</p>
            <p>剩余时间：<span className="text-lg font-semibold">{secsLeft(snapshot) ?? "-"}s</span></p>
            <p>发现来源：{snapshot?.market.source ?? "-"}</p>
            <p>候选轮次：{snapshot?.candidates.slice(0, 4).join(" | ") ?? "-"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>账户</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p>现金：{formatMoney(account.cash)}</p>
            <p>持仓市值：{formatMoney(inventoryValue)}</p>
            <p>总权益：{formatMoney(account.cash + inventoryValue)}</p>
            <p>已实现盈亏：{formatMoney(account.realized)}</p>
            <p>未实现盈亏：{formatMoney(unrealized)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>价格与交易</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded border border-slate-200 p-3">
              <p className="font-semibold">UP</p>
              <p>Bid: {formatPrice(snapshot?.prices.up.bid ?? null)}</p>
              <p>Ask: {formatPrice(snapshot?.prices.up.ask ?? null)}</p>
              <p>Mid: {formatPrice(snapshot?.prices.up.mid ?? null)}</p>
              <p>持仓: {account.positions.UP.qty.toFixed(4)}</p>
            </div>
            <div className="rounded border border-slate-200 p-3">
              <p className="font-semibold">DOWN</p>
              <p>Bid: {formatPrice(snapshot?.prices.down.bid ?? null)}</p>
              <p>Ask: {formatPrice(snapshot?.prices.down.ask ?? null)}</p>
              <p>Mid: {formatPrice(snapshot?.prices.down.mid ?? null)}</p>
              <p>持仓: {account.positions.DOWN.qty.toFixed(4)}</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <label className="space-y-1 text-xs">
              <span>每次购买金额（美元）</span>
              <input className="w-full rounded-md border border-slate-200 px-2 py-1" type="number" min={1} value={tradeUsd} onChange={(e) => setTradeUsd(Number(e.target.value))} />
            </label>
            <label className="space-y-1 text-xs">
              <span>滑点缓冲</span>
              <input className="w-full rounded-md border border-slate-200 px-2 py-1" type="number" step="0.001" min={0} value={slip} onChange={(e) => setSlip(Number(e.target.value))} />
            </label>
            <label className="space-y-1 text-xs">
              <span>触发阈值</span>
              <input className="w-full rounded-md border border-slate-200 px-2 py-1" type="number" step="0.001" min={0.001} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
            </label>
            <label className="space-y-1 text-xs">
              <span>临近结算平仓秒数</span>
              <input className="w-full rounded-md border border-slate-200 px-2 py-1" type="number" step="1" min={5} value={flatBefore} onChange={(e) => setFlatBefore(Number(e.target.value))} />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => buySide("UP")}>买入 UP</Button>
            <Button onClick={() => buySide("DOWN")}>买入 DOWN</Button>
            <Button variant="outline" onClick={() => sellAll("UP")}>卖出全部 UP</Button>
            <Button variant="outline" onClick={() => sellAll("DOWN")}>卖出全部 DOWN</Button>
            <Button variant="outline" onClick={() => setAuto((v) => !v)}>{auto ? "关闭自动策略" : "开启自动策略"}</Button>
            <Button variant="outline" onClick={() => refreshSnapshot(true)}>立即刷新</Button>
            <Button
              variant="outline"
              onClick={() => {
                setAccount({ cash: 1000, realized: 0, positions: { UP: { qty: 0, avg: 0 }, DOWN: { qty: 0, avg: 0 } } });
                pushLog("账户已重置");
              }}
            >
              重置账户
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>连接与日志</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-sm text-slate-600">代理状态：{proxyStatus}；自动跟随：开启（2.5 秒轮询，服务端聚合 + 短 TTL 缓存）。</p>
          <div className="h-64 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 font-mono text-xs text-slate-700">
            {logs.length ? logs.join("\n") : "暂无日志"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

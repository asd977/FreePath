import { MarketAssetType, MarketIndicatorSnapshot, MarketRecommendation } from "@/types/market";

type KlinePoint = {
  date: string;
  close: number;
};

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  const mean = average(values);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function movingAverage(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return average(slice);
}

function exponentialMovingAverage(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const multiplier = 2 / (period + 1);
  const ema: number[] = [values[0]];
  for (let i = 1; i < values.length; i += 1) {
    ema.push((values[i] - ema[i - 1]) * multiplier + ema[i - 1]);
  }
  return ema;
}

function calculateRsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;

  for (let i = closes.length - period; i < closes.length; i += 1) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function calculateMacd(closes: number[]): { macd: number | null; signal: number | null; histogram: number | null } {
  if (closes.length < 35) return { macd: null, signal: null, histogram: null };
  const ema12 = exponentialMovingAverage(closes, 12);
  const ema26 = exponentialMovingAverage(closes, 26);
  const macdLine = closes.map((_, i) => ema12[i] - ema26[i]);
  const signalLine = exponentialMovingAverage(macdLine, 9);
  const macd = macdLine.at(-1) ?? null;
  const signal = signalLine.at(-1) ?? null;

  if (macd === null || signal === null) {
    return { macd: null, signal: null, histogram: null };
  }
  return { macd, signal, histogram: macd - signal };
}

function calculateBollinger(closes: number[], period = 20, stdMultiplier = 2) {
  if (closes.length < period) {
    return { upper: null, middle: null, lower: null, position: null };
  }

  const sample = closes.slice(-period);
  const middle = average(sample);
  const std = standardDeviation(sample);
  const upper = middle + stdMultiplier * std;
  const lower = middle - stdMultiplier * std;
  const latest = closes.at(-1) ?? middle;
  const position = upper === lower ? 0.5 : (latest - lower) / (upper - lower);

  return { upper, middle, lower, position: Number.isFinite(position) ? position : null };
}

function calculatePeriodChange(closes: number[], days: number): number | null {
  if (closes.length <= days) return null;
  const past = closes[closes.length - days - 1];
  const latest = closes.at(-1) ?? past;
  if (past === 0) return null;
  return ((latest - past) / past) * 100;
}

function calculateAnnualizedVolatility(closes: number[], window = 20): number | null {
  if (closes.length <= window) return null;
  const returns: number[] = [];
  for (let i = closes.length - window; i < closes.length; i += 1) {
    const prev = closes[i - 1];
    const current = closes[i];
    if (prev <= 0 || current <= 0) continue;
    returns.push(Math.log(current / prev));
  }
  if (returns.length < 2) return null;
  return standardDeviation(returns) * Math.sqrt(252) * 100;
}

function calculateMaxDrawdown(closes: number[], lookback = 252): number | null {
  if (closes.length < 2) return null;
  const sample = closes.slice(-lookback);
  let peak = sample[0];
  let maxDrawdown = 0;

  for (const value of sample) {
    peak = Math.max(peak, value);
    if (peak > 0) {
      const dd = ((value - peak) / peak) * 100;
      maxDrawdown = Math.min(maxDrawdown, dd);
    }
  }

  return maxDrawdown;
}

function calculatePercentile(closes: number[], lookback: number): number | null {
  if (closes.length < 20) return null;
  const sample = closes.slice(-lookback);
  const min = Math.min(...sample);
  const max = Math.max(...sample);
  const latest = sample.at(-1) ?? min;
  if (max === min) return 50;
  return ((latest - min) / (max - min)) * 100;
}

export function buildIndicatorSnapshot(history: KlinePoint[]): MarketIndicatorSnapshot {
  const closes = history.map((item) => item.close).filter((n) => Number.isFinite(n));
  const latestClose = closes.at(-1) ?? 0;

  const { macd, signal, histogram } = calculateMacd(closes);
  const bollinger = calculateBollinger(closes, 20, 2);

  return {
    latestClose,
    ma20: movingAverage(closes, 20),
    ma60: movingAverage(closes, 60),
    ma120: movingAverage(closes, 120),
    rsi14: calculateRsi(closes, 14),
    macd,
    macdSignal: signal,
    macdHistogram: histogram,
    bollingerUpper: bollinger.upper,
    bollingerMiddle: bollinger.middle,
    bollingerLower: bollinger.lower,
    bollingerPosition: bollinger.position,
    change1mPct: calculatePeriodChange(closes, 21),
    change3mPct: calculatePeriodChange(closes, 63),
    change6mPct: calculatePeriodChange(closes, 126),
    annualizedVolatility20d: calculateAnnualizedVolatility(closes, 20),
    maxDrawdown1yPct: calculateMaxDrawdown(closes, 252),
    percentile1y: calculatePercentile(closes, 252),
    percentile3y: calculatePercentile(closes, 252 * 3),
    percentile5y: calculatePercentile(closes, 252 * 5),
  };
}

function scoreToRecommendation(score: number): MarketRecommendation {
  if (score >= 3) return "buy";
  if (score <= -3) return "sell";
  return "hold";
}

export function buildRecommendation(params: {
  indicators: MarketIndicatorSnapshot;
  peTtm: number | null;
  assetType: MarketAssetType;
}): { score: number; recommendation: MarketRecommendation; reasons: string[] } {
  const { indicators, peTtm, assetType } = params;
  let score = 0;
  const reasons: string[] = [];

  if (indicators.ma20 && indicators.ma60) {
    if (indicators.ma20 > indicators.ma60) {
      score += 1;
      reasons.push("20日均线在60日均线上方，短中期趋势偏强");
    } else {
      score -= 1;
      reasons.push("20日均线跌破60日均线，趋势转弱");
    }
  }

  if (indicators.ma60 && indicators.ma120) {
    if (indicators.ma60 > indicators.ma120) score += 1;
    else score -= 1;
  }

  if (indicators.rsi14 !== null) {
    if (indicators.rsi14 < 30) {
      score += 1;
      reasons.push("RSI(14) 进入超卖区，存在反弹概率");
    } else if (indicators.rsi14 > 70) {
      score -= 1;
      reasons.push("RSI(14) 进入超买区，短期回调风险增加");
    }
  }

  if (indicators.macdHistogram !== null) {
    if (indicators.macdHistogram > 0) score += 1;
    else score -= 1;
  }

  if (indicators.percentile3y !== null) {
    if (indicators.percentile3y < 20) {
      score += 1;
      reasons.push("价格位于近3年低分位，估值/情绪相对便宜");
    } else if (indicators.percentile3y > 80) {
      score -= 1;
      reasons.push("价格处于近3年高分位，追高性价比偏低");
    }
  }

  if (indicators.annualizedVolatility20d !== null && indicators.annualizedVolatility20d > 35) {
    score -= 1;
    reasons.push("20日年化波动率较高，仓位需更保守");
  }

  if (assetType === "stock" && peTtm !== null) {
    if (peTtm < 15) {
      score += 1;
      reasons.push("PE(TTM) 处于偏低区间（<15）");
    } else if (peTtm > 40) {
      score -= 1;
      reasons.push("PE(TTM) 偏高（>40），需防估值回归");
    }
  }

  return {
    score,
    recommendation: scoreToRecommendation(score),
    reasons,
  };
}

export function parseSecId(rawCode: string): { secId: string; code: string; assetType: MarketAssetType } | null {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;

  const pure = code.replace(/[^A-Z0-9]/g, "");
  if (/^(SH|SZ|BJ)\d{6}$/.test(pure)) {
    const marketPrefix = pure.slice(0, 2);
    const symbol = pure.slice(2);
    if (marketPrefix === "SH") return { secId: `1.${symbol}`, code, assetType: symbol.startsWith("0") ? "index" : "stock" };
    if (marketPrefix === "SZ") return { secId: `0.${symbol}`, code, assetType: symbol.startsWith("39") ? "index" : "stock" };
    return { secId: `0.${symbol}`, code, assetType: "stock" };
  }

  if (/^\d{6}$/.test(pure)) {
    if (pure.startsWith("6") || pure.startsWith("9")) {
      return { secId: `1.${pure}`, code, assetType: "stock" };
    }
    if (pure.startsWith("0") || pure.startsWith("3")) {
      return { secId: `0.${pure}`, code, assetType: pure.startsWith("39") ? "index" : "stock" };
    }
    return null;
  }

  return null;
}

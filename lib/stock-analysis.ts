import { StockAnalysisResult, StockInput } from "@/types/stock";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function analyzeStock(stock: StockInput): StockAnalysisResult {
  const valuationScore = clamp(
    100 - (stock.pePercentile * 0.6 + stock.pbPercentile * 0.4) + Math.min(stock.dividendYieldPct * 4, 12),
  );

  const trendBase = (stock.currentPrice > stock.ma20 ? 25 : 5) + (stock.ma20 > stock.ma60 ? 25 : 5) + (stock.ma60 > stock.ma120 ? 20 : 5);
  const rsiScore = stock.rsi14 >= 45 && stock.rsi14 <= 65 ? 20 : stock.rsi14 < 30 || stock.rsi14 > 75 ? 6 : 12;
  const macdScore = stock.macdHist >= 0 ? 10 : 4;
  const trendScore = clamp(trendBase + rsiScore + macdScore);

  const qualityScore = clamp(stock.roePct * 2 + stock.revenueGrowthPct * 1.5 - Math.max(stock.debtToAssetPct - 55, 0) * 1.2);

  const riskControlScore = clamp(
    100 - Math.max(stock.debtToAssetPct - 40, 0) * 1.5 - (stock.rsi14 > 75 ? 12 : 0) - (stock.rsi14 < 25 ? 8 : 0),
  );

  const overallScore = round(valuationScore * 0.3 + trendScore * 0.3 + qualityScore * 0.25 + riskControlScore * 0.15);

  const methods = [
    {
      method: "估值法（PE/PB历史分位 + 股息）",
      score: round(valuationScore),
      summary: `PE分位 ${stock.pePercentile}% / PB分位 ${stock.pbPercentile}%，分位越低越偏便宜。`,
    },
    {
      method: "趋势动量法（均线 + RSI + MACD）",
      score: round(trendScore),
      summary: `现价 ${stock.currentPrice.toFixed(2)}，MA20/60/120 = ${stock.ma20.toFixed(2)}/${stock.ma60.toFixed(2)}/${stock.ma120.toFixed(2)}。`,
    },
    {
      method: "质量成长法（ROE + 营收增速）",
      score: round(qualityScore),
      summary: `ROE ${stock.roePct}%、营收增速 ${stock.revenueGrowthPct}%、资产负债率 ${stock.debtToAssetPct}%。`,
    },
    {
      method: "风险约束法（债务 + 过热/超卖）",
      score: round(riskControlScore),
      summary: `债务和技术面极值会降低仓位建议。`,
    },
  ];

  const keySignals: string[] = [];
  const riskWarnings: string[] = [];

  if (stock.pePercentile <= 30) keySignals.push("估值处于历史相对低位（PE分位较低）");
  if (stock.pePercentile >= 80) riskWarnings.push("PE历史分位偏高，估值有回归风险");
  if (stock.currentPrice > stock.ma20 && stock.ma20 > stock.ma60) keySignals.push("短中期趋势向上（价在20日线上方，且20日线上穿60日）");
  if (stock.rsi14 > 75) riskWarnings.push("RSI处于高位，短线可能过热");
  if (stock.rsi14 < 30) keySignals.push("RSI偏低，可能接近超卖区");
  if (stock.debtToAssetPct > 65) riskWarnings.push("资产负债率较高，需关注财务稳健性");
  if (stock.roePct >= 15) keySignals.push("ROE较好，盈利能力强");

  let recommendation: StockAnalysisResult["recommendation"] = "观望";
  if (overallScore >= 70) recommendation = "买入";
  if (overallScore <= 42) recommendation = "减仓/卖出";

  let confidence: StockAnalysisResult["confidence"] = "中";
  const spread = Math.max(...methods.map((m) => m.score)) - Math.min(...methods.map((m) => m.score));
  if (spread <= 20) confidence = "高";
  if (spread >= 40) confidence = "低";

  return {
    overallScore,
    recommendation,
    confidence,
    methods,
    keySignals,
    riskWarnings,
  };
}

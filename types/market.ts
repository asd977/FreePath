export type MarketAssetType = "stock" | "etf" | "index" | "unknown";

export type MarketRecommendation = "buy" | "hold" | "sell";

export type MarketInputItem = {
  code: string;
};

export type MarketIndicatorSnapshot = {
  latestClose: number;
  ma20: number | null;
  ma60: number | null;
  ma120: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  bollingerUpper: number | null;
  bollingerMiddle: number | null;
  bollingerLower: number | null;
  bollingerPosition: number | null;
  change1mPct: number | null;
  change3mPct: number | null;
  change6mPct: number | null;
  annualizedVolatility20d: number | null;
  maxDrawdown1yPct: number | null;
  percentile1y: number | null;
  percentile3y: number | null;
  percentile5y: number | null;
};

export type MarketValuationSnapshot = {
  peTtm: number | null;
  pb: number | null;
  pePercentile5y: number | null;
  note?: string;
};

export type MarketAnalysisResult = {
  code: string;
  secId: string;
  name: string;
  assetType: MarketAssetType;
  latestPrice: number;
  dayChangePct: number;
  indicators: MarketIndicatorSnapshot;
  valuation: MarketValuationSnapshot;
  score: number;
  recommendation: MarketRecommendation;
  reasons: string[];
  fetchedAt: string;
};

export type MarketAnalysisResponse = {
  items: MarketAnalysisResult[];
  failed: Array<{ code: string; reason: string }>;
};

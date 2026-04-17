export type StockInput = {
  id: string;
  code: string;
  name: string;
  currentPrice: number;
  pe: number;
  pb: number;
  pePercentile: number;
  pbPercentile: number;
  rsi14: number;
  macdHist: number;
  ma20: number;
  ma60: number;
  ma120: number;
  roePct: number;
  revenueGrowthPct: number;
  debtToAssetPct: number;
  dividendYieldPct: number;
  note?: string;
  createdAt: string;
};

export type AnalysisMethodResult = {
  method: string;
  score: number;
  summary: string;
};

export type StockAnalysisResult = {
  overallScore: number;
  recommendation: "买入" | "观望" | "减仓/卖出";
  confidence: "高" | "中" | "低";
  methods: AnalysisMethodResult[];
  keySignals: string[];
  riskWarnings: string[];
};

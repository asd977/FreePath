import { SectionHeading } from "@/components/common/section-heading";
import { PolymarketMonitor } from "@/components/polymarket/polymarket-monitor";

export default function PolymarketPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="Polymarket BTC 5m 三策略自动交易（高概率版）"
        description="3 套自动策略同时运行：每套起始资金 10、每次只投入 1，围绕高概率边做折价、趋势、回撤入场，并持续统计收益与胜率。"
      />
      <PolymarketMonitor />
    </div>
  );
}

import { SectionHeading } from "@/components/common/section-heading";
import { PolymarketMonitor } from "@/components/polymarket/polymarket-monitor";

export default function PolymarketPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="Polymarket BTC 5m 三策略自动塌缩交易"
        description="3 套自动策略同时运行：每套起始资金 10、每次只投入 1，只有出现塌缩信号才开仓，并持续统计收益与胜率。"
      />
      <PolymarketMonitor />
    </div>
  );
}

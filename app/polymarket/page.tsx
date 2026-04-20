import { SectionHeading } from "@/components/common/section-heading";
import { PolymarketMonitor } from "@/components/polymarket/polymarket-monitor";

export default function PolymarketPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="Polymarket BTC 5m 五策略自动交易（含E随机测试）"
        description="5 套自动策略同时运行：每套起始资金 10、每次只投入 1；新增 E 策略每轮随机下注一次用于测试下单链路。"
      />
      <PolymarketMonitor />
    </div>
  );
}

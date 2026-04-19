import { SectionHeading } from "@/components/common/section-heading";
import { PolymarketMonitor } from "@/components/polymarket/polymarket-monitor";

export default function PolymarketPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="Polymarket BTC 5m 四策略自动交易（含D策略）"
        description="4 套自动策略同时运行：每套起始资金 10、每次只投入 1；新增 D 策略结合锚点偏离、短线结构、公平概率与流动性过滤。"
      />
      <PolymarketMonitor />
    </div>
  );
}

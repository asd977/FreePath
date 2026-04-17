import { SectionHeading } from "@/components/common/section-heading";
import { PolymarketMonitor } from "@/components/polymarket/polymarket-monitor";

export default function PolymarketPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="Polymarket BTC 5m 模拟交易器"
        description="已融入 FreePath：由服务端自动抓取 /crypto/5M 发现当前轮次，持续轮询并可随时查看状态。"
      />
      <PolymarketMonitor />
    </div>
  );
}

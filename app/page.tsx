import { SectionHeading } from "@/components/common/section-heading";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <SectionHeading title="个人财务转型仪表盘" description="帮助你规划何时退出全职，转向更自由的生活。" />
      <DashboardShell />
    </div>
  );
}

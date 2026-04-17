"use client";

import dynamic from "next/dynamic";

export const DashboardShellWrapper = dynamic(
  () => import("@/components/dashboard/dashboard-shell").then((mod) => mod.DashboardShell),
  {
    ssr: false,
  },
);

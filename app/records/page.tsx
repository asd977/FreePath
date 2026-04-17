"use client";

import dynamic from "next/dynamic";

const RecordsClientPage = dynamic(() => import("./records-client").then((mod) => mod.RecordsClientPage), {
  ssr: false,
});

export default function RecordsPage() {
  return <RecordsClientPage />;
}

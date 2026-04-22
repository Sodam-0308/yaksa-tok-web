import { createMetadata } from "@/lib/metadata";
import ChartNewClient from "./ChartNewClient";

export const metadata = createMetadata({
  title: "약사톡 — 새 환자 등록",
  description: "새 환자를 직접 등록하여 차트를 시작합니다.",
});

export default function Page() {
  return <ChartNewClient />;
}

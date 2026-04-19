import { createMetadata } from "@/lib/metadata";
import ChartClient from "./ChartClient";

export const metadata = createMetadata({
  title: "약사톡 — 환자 차트",
  description: "환자 상세 정보를 한눈에 확인하세요.",
});

export default function Page() {
  return <ChartClient />;
}

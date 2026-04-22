import { createMetadata } from "@/lib/metadata";
import PerformanceClient from "./PerformanceClient";

export const metadata = createMetadata({
  title: "약사톡 — 내 실적",
  description: "뱃지, 상담 실적, 내가 작성한 개선 사례를 확인하세요.",
});

export default function Page() {
  return <PerformanceClient />;
}

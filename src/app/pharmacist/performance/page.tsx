import { createMetadata } from "@/lib/metadata";
import PerformanceClient from "./PerformanceClient";

export const metadata = createMetadata({
  title: "약사톡 — 내 사례·이야기 관리",
  description: "내가 작성한 개선 사례와 이야기를 관리하세요.",
});

export default function Page() {
  return <PerformanceClient />;
}

import { createMetadata } from "@/lib/metadata";
import RecommendClient from "./RecommendClient";

export const metadata = createMetadata({
  title: "약사톡 — 약사의 이야기 작성",
  description: "약사로서 경험한 개선 이야기를 공유하세요.",
});

export default function Page() {
  return <RecommendClient />;
}

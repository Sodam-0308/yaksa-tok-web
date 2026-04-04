import { createMetadata } from "@/lib/metadata";
import FeedClient from "./FeedClient";

export const metadata = createMetadata({
  title: "약사톡 — 개선 사례",
  description:
    "실제 약사의 영양 상담으로 증상이 개선된 사례를 확인하세요.",
});

export default function Page() {
  return <FeedClient />;
}

import { createMetadata } from "@/lib/metadata";
import FeedClient from "./FeedClient";

export const metadata = createMetadata({
  title: "약사톡 — 피드",
  description:
    "개선 사례와 약사의 추천 글을 확인하세요.",
});

export default function Page() {
  return <FeedClient />;
}

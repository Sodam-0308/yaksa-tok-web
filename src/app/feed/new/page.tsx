import { createMetadata } from "@/lib/metadata";
import FeedNewClient from "./FeedNewClient";

export const metadata = createMetadata({
  title: "약사톡 — 개선 사례 등록",
  description: "환자 개선 사례를 등록하고 경험을 공유하세요.",
});

export default function Page() {
  return <FeedNewClient />;
}

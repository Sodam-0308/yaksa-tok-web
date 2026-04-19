import { createMetadata } from "@/lib/metadata";
import StoryDetailClient from "./StoryDetailClient";

export const metadata = createMetadata({
  title: "약사톡 — 약사의 이야기",
  description: "약사의 실제 개선 경험을 확인하세요.",
});

export default function Page() {
  return <StoryDetailClient />;
}

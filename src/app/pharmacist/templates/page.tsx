import { createMetadata } from "@/lib/metadata";
import TemplatesClient from "./TemplatesClient";

export const metadata = createMetadata({
  title: "약사톡 — 답변 템플릿",
  description: "자주 쓰는 답변을 템플릿으로 저장하고 채팅에서 빠르게 불러쓰세요.",
});

export default function Page() {
  return <TemplatesClient />;
}

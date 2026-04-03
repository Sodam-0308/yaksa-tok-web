import { createMetadata } from "@/lib/metadata";
import ChatClient from "./ChatClient";

export const metadata = createMetadata({
  title: "약사톡 — 채팅 상담",
  description: "약사와 1:1 채팅 상담. 편하게 건강 고민을 나눠보세요.",
});

export default function Page() {
  return <ChatClient />;
}

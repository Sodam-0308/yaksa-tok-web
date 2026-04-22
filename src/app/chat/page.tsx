import { createMetadata } from "@/lib/metadata";
import ChatListClient from "./ChatListClient";

export const metadata = createMetadata({
  title: "약사톡 — 채팅 목록",
  description: "진행 중인 채팅 상담을 확인하세요.",
});

export default function Page() {
  return <ChatListClient />;
}

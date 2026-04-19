import { createMetadata } from "@/lib/metadata";
import MypageClient from "./MypageClient";

export const metadata = createMetadata({
  title: "약사톡 — 내 정보",
  description: "내 건강 관리 현황을 한눈에 확인하세요.",
});

export default function Page() {
  return <MypageClient />;
}

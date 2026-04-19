import { createMetadata } from "@/lib/metadata";
import PharmacistMypageClient from "./PharmacistMypageClient";

export const metadata = createMetadata({
  title: "약사톡 — 내 정보 (약사)",
  description: "약사 프로필, 전문 분야, 상담 슬롯을 관리하세요.",
});

export default function Page() {
  return <PharmacistMypageClient />;
}

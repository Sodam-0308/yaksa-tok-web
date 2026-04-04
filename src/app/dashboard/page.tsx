import { createMetadata } from "@/lib/metadata";
import DashboardClient from "./DashboardClient";

export const metadata = createMetadata({
  title: "약사톡 — 약사 대시보드",
  description: "환자 상담 관리, 상담 요청 확인, 답변 작성을 한 곳에서.",
});

export default function Page() {
  return <DashboardClient />;
}

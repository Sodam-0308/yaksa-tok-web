import { createMetadata } from "@/lib/metadata";
import ReportNewClient from "./ReportNewClient";

export const metadata = createMetadata({
  title: "약사톡 — 가이드 작성",
  description: "환자 맞춤 방문 전·후 가이드를 작성하고 전송하세요.",
});

export default function Page() {
  return <ReportNewClient />;
}

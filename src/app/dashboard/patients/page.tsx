import { createMetadata } from "@/lib/metadata";
import PatientsClient from "./PatientsClient";

export const metadata = createMetadata({
  title: "약사톡 — 환자 목록",
  description: "전체 환자를 표·검색·필터로 탐색하세요.",
});

export default function Page() {
  return <PatientsClient />;
}

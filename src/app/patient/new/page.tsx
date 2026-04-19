import { createMetadata } from "@/lib/metadata";
import PatientNewClient from "./PatientNewClient";

export const metadata = createMetadata({
  title: "약사톡 — 환자 직접 등록",
  description: "약국에 직접 방문한 환자를 등록합니다.",
});

export default function Page() {
  return <PatientNewClient />;
}

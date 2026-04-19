import { createMetadata } from "@/lib/metadata";
import HealthCheckClient from "./HealthCheckClient";

export const metadata = createMetadata({
  title: "약사톡 — 몸 상태 체크",
  description: "오늘의 몸 상태를 체크하고 건강 변화를 확인하세요.",
});

export default function Page() {
  return <HealthCheckClient />;
}

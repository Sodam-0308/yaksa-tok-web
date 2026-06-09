import { createMetadata } from "@/lib/metadata";
import ScheduleClient from "./ScheduleClient";

export const metadata = createMetadata({
  title: "약사톡 — 상담 스케줄",
  description: "상담 가능 시간, 불가 날짜, 최대 동시 상담 수를 설정하세요.",
});

export default function Page() {
  return <ScheduleClient />;
}

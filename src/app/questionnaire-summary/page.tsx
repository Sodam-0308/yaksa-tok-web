import { createMetadata } from "@/lib/metadata";
import QuestionnaireSummaryClient from "./QuestionnaireSummaryClient";

export const metadata = createMetadata({
  title: "약사톡 — 내 답변 확인",
});

export default function Page() {
  return <QuestionnaireSummaryClient />;
}

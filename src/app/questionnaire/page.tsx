import { createMetadata } from "@/lib/metadata";
import QuestionnaireClient from "./QuestionnaireClient";

export const metadata = createMetadata({
  title: "약사톡 — 증상 분석",
});

export default function Page() {
  return <QuestionnaireClient />;
}

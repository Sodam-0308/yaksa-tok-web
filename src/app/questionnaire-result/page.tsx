import { createMetadata } from "@/lib/metadata";
import QuestionnaireResultClient from "./QuestionnaireResultClient";

export const metadata = createMetadata({
  title: "약사톡 — 문답 결과",
  description: "문답이 완료되었어요. 매칭된 약사님을 확인하려면 가입해 주세요.",
});

export default function Page() {
  return <QuestionnaireResultClient />;
}

import { createMetadata } from "@/lib/metadata";
import QuestionnaireListClient from "./QuestionnaireListClient";

export const metadata = createMetadata({
  title: "약사톡 — 맞춤 추가 문답",
  description: "자주 묻는 문답을 세트로 만들어 환자에게 보낼 수 있어요.",
});

export default function Page() {
  return <QuestionnaireListClient />;
}

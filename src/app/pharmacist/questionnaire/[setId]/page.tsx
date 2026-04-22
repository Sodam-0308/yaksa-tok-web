import { createMetadata } from "@/lib/metadata";
import QuestionnaireSetEditClient from "./QuestionnaireSetEditClient";

export const metadata = createMetadata({
  title: "약사톡 — 개별 문답 세트",
  description: "환자에게 보낼 개별 문답 세트를 관리합니다.",
});

export default function Page() {
  return <QuestionnaireSetEditClient />;
}

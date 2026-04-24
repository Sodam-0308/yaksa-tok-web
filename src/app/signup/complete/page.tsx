import { createMetadata } from "@/lib/metadata";
import SignupCompleteClient from "./SignupCompleteClient";

export const metadata = createMetadata({
  title: "약사톡 — 가입 완료",
  description: "약사톡에 오신 걸 환영해요. 이름과 역할을 선택해주세요.",
});

export default function Page() {
  return <SignupCompleteClient />;
}

import { createMetadata } from "@/lib/metadata";
import PharmacistSignupClient from "./PharmacistSignupClient";

export const metadata = createMetadata({
  title: "약사톡 — 약사 가입",
  description: "약사톡에 약사로 가입하고 환자의 건강 개선을 도와주세요.",
});

export default function Page() {
  return <PharmacistSignupClient />;
}

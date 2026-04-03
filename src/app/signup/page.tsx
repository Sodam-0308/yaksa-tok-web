import { createMetadata } from "@/lib/metadata";
import SignupClient from "./SignupClient";

export const metadata = createMetadata({
  title: "약사톡 — 시작하기",
});

export default function Page() {
  return <SignupClient />;
}

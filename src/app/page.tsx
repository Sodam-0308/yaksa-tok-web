import { createMetadata } from "@/lib/metadata";
import LandingClient from "./LandingClient";

export const metadata = createMetadata({
  title: "약사톡 — 근처 전문 약사와 1:1 맞춤 건강 상담",
});

export default function Page() {
  return <LandingClient />;
}

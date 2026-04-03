import { createMetadata } from "@/lib/metadata";
import MatchClient from "./MatchClient";

export const metadata = createMetadata({
  title: "약사톡 — 근처 약사 찾기",
});

export default function Page() {
  return <MatchClient />;
}

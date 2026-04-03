import { createMetadata } from "@/lib/metadata";
import PharmacistClient from "./PharmacistClient";

export const metadata = createMetadata({
  title: "약사톡 — 약사 프로필",
});

export default function Page() {
  return <PharmacistClient />;
}

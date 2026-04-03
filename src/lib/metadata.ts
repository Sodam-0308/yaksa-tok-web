import type { Metadata } from "next";

const OG_COMMON = {
  siteName: "약사톡",
  type: "website" as const,
  locale: "ko_KR",
};

export function createMetadata(overrides: {
  title: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
}): Metadata {
  const description =
    overrides.description ??
    "근처 전문 약사와 1:1 맞춤 건강 상담. 병원에서 해결 안 되는 만성 증상, 가까운 약사가 함께합니다.";
  const ogDescription =
    overrides.ogDescription ??
    "병원에서 해결 안 되는 만성 증상, 가까운 약사가 함께합니다. 무료 상담.";

  return {
    title: overrides.title,
    description,
    openGraph: {
      ...OG_COMMON,
      title: overrides.ogTitle ?? overrides.title,
      description: ogDescription,
    },
  };
}

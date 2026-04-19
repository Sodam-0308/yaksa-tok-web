import type { Metadata } from "next";
import "@/styles/globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: {
    default: "약사톡 — 근처 전문 약사와 1:1 맞춤 건강 상담",
    template: "%s",
  },
  description:
    "근처 전문 약사와 1:1 맞춤 건강 상담. 병원에서 해결 안 되는 만성 증상, 가까운 약사가 함께합니다.",
  openGraph: {
    siteName: "약사톡",
    title: "약사톡 — 근처 전문 약사와 1:1 맞춤 건강 상담",
    description:
      "병원에서 해결 안 되는 만성 증상, 가까운 약사가 함께합니다. 무료 상담.",
    type: "website",
    locale: "ko_KR",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;500;700;800&family=Noto+Sans+KR:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <BottomNav />
      </body>
    </html>
  );
}

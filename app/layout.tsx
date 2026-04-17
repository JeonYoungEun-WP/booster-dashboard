import type { Metadata } from "next";
import { GNB } from "@/src/components/layout/GNB";
import "./globals.css";

export const metadata: Metadata = {
  title: "Booster Dashboard",
  description: "Google · Meta · Naver · Kakao · TikTok · 당근 통합 광고 성과 분석",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <GNB />
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Sidebar, MobileTabBar } from "@/src/components/layout/Sidebar";
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
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0 pb-16 md:pb-0">
            {children}
          </main>
        </div>
        <MobileTabBar />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import HeroBackground from "@/components/HeroBackground";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "Offer派 - 应届生求职信息聚合",
  description:
    "聚合国家 24365 平台与高校就业网的校招/实习信息，校招日历、DDL 提醒、求职看板、AI 匹配一站汇聚，全部跳转官方投递入口。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#171e19",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          rel="stylesheet"
          href="https://miaoda.feishu.cn/fonts/css2?family=Nunito:wght@400;600;700;800;900&family=Noto+Sans+SC:wght@400;500;700;900&display=swap"
        />
      </head>
      <body>
        <HeroBackground />
        <Nav />
        {children}
        <footer className="site-foot">
          <div className="wrap">
            <p>数据来源：国家 24365 平台 · 福建就业网 · 福建人才联合网 · 福建理工大学就业网</p>
            <p>所有岗位均跳转官方投递入口，本站不截留简历、不收集投递信息</p>
          </div>
        </footer>
        <SpeedInsights />
      </body>
    </html>
  );
}

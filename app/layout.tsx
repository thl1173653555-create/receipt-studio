import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "餐馆小票生成器 | Бэй Хай",
  description: "为俄罗斯餐馆生成可打印的58mm和80mm热敏小票。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

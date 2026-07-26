import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DAYTRACK — 음악으로 기록하는 하루",
  description: "지금 듣는 음악과 함께 하루의 순간을 기록하세요.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f3efe6" }, { media: "(prefers-color-scheme: dark)", color: "#171714" }],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}

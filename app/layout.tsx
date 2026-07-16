import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mộc Đọc — Trình đọc truyện TXT",
  description:
    "Mở và định dạng chương truyện từ file TXT thành một trang đọc thoải mái, riêng tư ngay trên thiết bị.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}

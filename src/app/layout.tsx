import type { Metadata } from "next";
import "./globals.css";
import "./typography-2026.css";

export const metadata: Metadata = {
  title: "Zuelen — Luxembourg business, under control",
  description: "Accounting and compliance for Luxembourg businesses.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

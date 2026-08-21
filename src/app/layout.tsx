import type { Metadata } from "next";
import "./globals.css";
import "./typography-2026.css";

export const metadata: Metadata = {
  title: "Zuelen — Luxembourg business, under control",
  description: "Accounting and compliance for Luxembourg businesses.",
  icons: {
    icon: "/zuelen-icon",
    shortcut: "/zuelen-icon",
    apple: "/zuelen-icon",
  },
};

const themeBootstrap = `
  try {
    const stored = localStorage.getItem("zuelen-theme");
    document.documentElement.dataset.zuelenTheme = stored === "dark" ? "dark" : "light";
  } catch (_) {
    document.documentElement.dataset.zuelenTheme = "light";
  }
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

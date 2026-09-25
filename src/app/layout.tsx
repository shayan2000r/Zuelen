import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zuelen — Luxembourg business, under control",
  description: "Accounting and compliance for Luxembourg businesses.",
  icons: {
    icon: [{ url: "/zuelen-icon.png", type: "image/png" }],
    shortcut: "/zuelen-icon.png",
    apple: "/zuelen-icon.png",
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

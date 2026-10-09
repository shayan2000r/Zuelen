import { Geist, Inter } from "next/font/google";

// Geist carries interface text; Inter with its optical-size axis renders as
// Inter Display at headline sizes. Both are exposed as CSS variables only, so
// pages opt in explicitly (see src/app/app/overview.module.css).
export const geist = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-geist", display: "swap" });
export const interDisplay = Inter({
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  variable: "--font-inter-display",
  display: "swap",
});

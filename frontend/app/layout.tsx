import type { Metadata } from "next";
import { Special_Gothic, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Primary typeface — one grotesque across headings and UI text.
// Loaded as a variable font so weight (400–700) and width (75–125) can be
// dialled in from globals.css instead of snapping to preset cuts.
const specialGothic = Special_Gothic({
  variable: "--font-gothic",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  fallback: ["Archivo", "Inter", "system-ui", "sans-serif"],
});

// Mono font — numeric/quantity cells
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Supply Chain Dashboard",
  description: "Supply Chain Management System — forecast, stock health & aging analytics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${specialGothic.variable} ${plexMono.variable}`}>
      <head>
        {/* Phosphor icon font — regular, bold & fill weights used across the UI */}
        <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css" />
        <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/bold/style.css" />
        <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/fill/style.css" />
      </head>
      <body className="theme-default">{children}</body>
    </html>
  );
}

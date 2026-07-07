import type { Metadata } from "next";
import { areal } from "@/lib/fonts";
import "./tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Walking Score",
  description: "Record a walk. The walk becomes a score.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={areal.variable}>
      <body>{children}</body>
    </html>
  );
}

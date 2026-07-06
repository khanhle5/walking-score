import type { Metadata } from "next";
import { areal } from "@/lib/fonts";
import "./tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Walk as Score",
  description: "Record a walk. Save it to Are.na as a score.",
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

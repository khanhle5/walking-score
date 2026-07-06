import localFont from "next/font/local";

// Areal variable font from @aredotna/tokens. Variable axes: "MONO" 0-100
// (sans -> mono), "slnt" for italics. See the package README.
export const areal = localFont({
  src: "../node_modules/@aredotna/tokens/fonts/areal.woff2",
  variable: "--font-areal",
  display: "swap",
  fallback: ["Arial", "Helvetica", "sans-serif"],
});

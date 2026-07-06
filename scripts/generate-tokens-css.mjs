// Generates app/tokens.css from @aredotna/tokens so CSS custom properties stay
// in sync with the package. Run with: npm run tokens
import { writeFileSync } from "node:fs";
import { COLORS, SPACE, FONT_SIZES, RADII, ALIASES, FONTS } from "@aredotna/tokens";

// The site is light-only by design (the score is a black line on white).
const theme = COLORS.light;

const lines = [];
lines.push("/* Generated from @aredotna/tokens — do not edit. Run `npm run tokens`. */");
lines.push(":root {");

for (const [key, value] of Object.entries(SPACE)) {
  lines.push(`  --space-${key}: ${value};`);
}
for (const [key, value] of Object.entries(FONT_SIZES)) {
  lines.push(`  --font-size-${key}: ${value};`);
}
for (const [key, value] of Object.entries(RADII)) {
  lines.push(`  --radius-${key}: ${value};`);
}
for (const [key, value] of Object.entries(theme)) {
  lines.push(`  --${key}: ${value};`);
}
// Aliases reference palette entries as "$gray0" etc.
for (const [key, value] of Object.entries(ALIASES)) {
  lines.push(`  --${key}: var(--${String(value).slice(1)});`);
}
// Areal is loaded via next/font (lib/fonts.ts), which provides --font-areal.
lines.push(`  --font-sans: var(--font-areal), ${FONTS.sans};`);
lines.push(`  --font-mono: var(--font-areal), ${FONTS.mono};`);
lines.push("}");
lines.push("");

writeFileSync(new URL("../app/tokens.css", import.meta.url), lines.join("\n"));
console.log("Wrote app/tokens.css");

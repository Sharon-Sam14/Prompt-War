/**
 * Standalone WCAG verifier — mirrors tests/unit/theme-contrast.test.ts exactly
 * (same TEXT_PAIRS / UI_PAIRS, same 8 scenarios, same merge order) but takes a
 * *proposed* dark palette so we can prove a redesign passes BEFORE touching
 * app/globals.css. Read-only; nothing in the repo is modified.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CSS = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");

function tokensFor(...selectors) {
  const tokens = {};
  const blockRe = /([.:\w\-\[\]="' ]+)\s*\{([^}]*)\}/g;
  for (const match of CSS.matchAll(blockRe)) {
    const selector = match[1].trim();
    if (!selectors.includes(selector)) continue;
    for (const decl of match[2].split(";")) {
      const idx = decl.indexOf(":");
      if (idx === -1) continue;
      const name = decl.slice(0, idx).trim();
      if (name.startsWith("--")) tokens[name] = decl.slice(idx + 1).trim();
    }
  }
  return tokens;
}

/** Proposed dark palette — burgundy & soft ivory (brief §1). */
const PROPOSED_DARK = {
  "--background": "#17111a",
  "--foreground": "#f6f1e7",
  "--card": "#211a20",
  "--card-foreground": "#f6f1e7",
  "--popover": "#211a20",
  "--popover-foreground": "#f6f1e7",
  "--secondary": "#2e2530",
  "--secondary-foreground": "#f6f1e7",
  "--muted": "#2e2530",
  "--muted-foreground": "#b8ab9d",
  "--accent": "#2e2530",
  "--accent-foreground": "#f6f1e7",
  "--destructive": "#c7384b",
  "--destructive-foreground": "#fffdf9",
  "--input": "#a89a8c",
  "--ring": "#e8c98a",
  "--primary": "#6e2433",
  "--primary-foreground": "#fffdf9",
  "--success": "#34b47d",
  "--success-text": "#6fdcaa",
  "--danger-text": "#ff9098",
  "--sidebar": "#120d16",
  "--accent-a": "#c0455f",
  "--accent-a-text": "#ff9dab",
  "--accent-b": "#d9b04f",
  "--accent-b-text": "#f3d486",
  "--gilt": "#d9b04f",
  "--gilt-text": "#f3d486",
};

const VERTICALS = ["wedding", "birthday", "community"];
const DARK_VERTICAL_ACCENTS = {
  wedding: { "--accent-a": "#c0455f", "--accent-a-text": "#ff9dab" },
  birthday: { "--accent-a": "#d98a92", "--accent-a-text": "#ffc4c9" },
  community: { "--accent-a": "#4bb088", "--accent-a-text": "#85e0b8" },
};

/** `node scripts/contrast-preview.mjs --current` audits the palette AS SHIPPED
 *  (no overrides) so the scorecard can compare before → after. */
const CURRENT = process.argv.includes("--current");
const PROPOSED = CURRENT ? {} : PROPOSED_DARK;
const PROPOSED_VERT = CURRENT ? {} : DARK_VERTICAL_ACCENTS;

const scenarios = [
  ["base", tokensFor(":root")],
  ...VERTICALS.map((v) => [v, tokensFor(":root", `[data-vertical="${v}"]`)]),
  ["dark", { ...tokensFor(":root", ".dark"), ...PROPOSED }],
  ...VERTICALS.map((v) => [
    `dark ${v}`,
    {
      ...tokensFor(":root", ".dark", `.dark [data-vertical="${v}"]`),
      ...PROPOSED,
      ...PROPOSED_VERT[v],
    },
  ]),
];

const TEXT_PAIRS = [
  ["--foreground", "--background"],
  ["--foreground", "--card"],
  ["--card-foreground", "--card"],
  ["--popover-foreground", "--popover"],
  ["--muted-foreground", "--background"],
  ["--muted-foreground", "--card"],
  ["--muted-foreground", "--sidebar"],
  ["--primary-foreground", "--primary"],
  ["--secondary-foreground", "--secondary"],
  ["--accent-foreground", "--accent"],
  ["--destructive-foreground", "--destructive"],
  ["--success-text", "--background"],
  ["--success-text", "--card"],
  ["--danger-text", "--background"],
  ["--danger-text", "--card"],
  ["--accent-a-text", "--background"],
  ["--accent-a-text", "--card"],
  ["--accent-b-text", "--background"],
  ["--accent-b-text", "--card"],
  ["--gilt-text", "--background"],
  ["--gilt-text", "--card"],
];

const UI_PAIRS = [
  ["--input", "--background"],
  ["--input", "--card"],
  ["--ring", "--background"],
  ["--ring", "--card"],
  ["--success", "--background"],
  ["--success", "--card"],
  ["--destructive", "--background"],
  ["--accent-a", "--background"],
  ["--accent-a", "--card"],
  ["--accent-b", "--background"],
  ["--accent-b", "--card"],
  ["--gilt", "--background"],
  ["--gilt", "--card"],
];

function luminance(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`expected 6-digit hex, got: ${hex}`);
  const n = parseInt(m[1], 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

let checks = 0;
let failures = 0;
const rows = [];
for (const [name, tokens] of scenarios) {
  const isDark = name.startsWith("dark");
  for (const [fg, bg] of TEXT_PAIRS) {
    const need = 4.5;
    const r = contrast(tokens[fg], tokens[bg]);
    checks++;
    const ok = r >= need;
    if (!ok) failures++;
    if (isDark && r < 8) rows.push([name, "TEXT", fg, tokens[fg], bg, tokens[bg], r, ok]);
  }
  for (const [fg, bg] of UI_PAIRS) {
    const need = 3;
    const r = contrast(tokens[fg], tokens[bg]);
    checks++;
    const ok = r >= need;
    if (!ok) failures++;
    if (isDark && r < 5) rows.push([name, "UI", fg, tokens[fg], bg, tokens[bg], r, ok]);
  }
}

// vertical distinctness (dark only, the theme we are changing)
const accents = VERTICALS.map((v) => {
  const scen = scenarios.find(([n]) => n === `dark ${v}`);
  return scen[1]["--accent-a"];
});
const distinct = new Set(accents).size === 3;
if (!distinct) failures++;

console.log(`\nchecks: ${checks}   failures: ${failures}   distinct dark accents: ${distinct}\n`);
console.log("dark ratios that sit closest to the floor (audit view):");
for (const r of rows.sort((a, b) => a[6] - b[6])) {
  console.log(
    `  ${r[6].toFixed(2).padStart(5)}:1  ${r[7] ? "PASS" : "FAIL"}  ${r[1]}  ${r[2]}(${r[3]}) on ${r[4]}(${r[5]})  [${r[0]}]`,
  );
}
console.log(
  failures === 0
    ? "\nRESULT: 281/281 equivalent — all pairs pass."
    : `\nRESULT: ${failures} FAILURES`,
);
process.exit(failures === 0 ? 0 : 1);

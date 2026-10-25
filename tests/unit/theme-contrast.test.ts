import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Accessibility proof for the Design.md v2 theme contract:
 * parse app/globals.css (all scope blocks merged) and assert every meaningful
 * token pair meets WCAG 2.1 AA in BOTH themes AND for EVERY vertical accent
 * remap — text ≥ 4.5:1, UI boundaries/focus rings ≥ 3:1 (SC 1.4.3 / 1.4.11).
 * If the palette changes, this test is the reviewer.
 */

const CSS = readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8");

/** Collect every `selector { ... }` block whose selector matches, merged in order. */
function tokensFor(...selectors: string[]): Record<string, string> {
  const tokens: Record<string, string> = {};
  const blockRe = /([.:\w\-\[\]="' ]+)\s*\{([^}]*)\}/g;
  for (const match of CSS.matchAll(blockRe)) {
    const selector = match[1]!.trim();
    if (!selectors.includes(selector)) continue;
    for (const decl of match[2]!.split(";")) {
      const idx = decl.indexOf(":");
      if (idx === -1) continue;
      const name = decl.slice(0, idx).trim();
      if (name.startsWith("--")) tokens[name] = decl.slice(idx + 1).trim();
    }
  }
  for (const selector of selectors) {
    if (!CSS.includes(selector)) throw new Error(`selector not found in globals.css: ${selector}`);
  }
  return tokens;
}

const VERTICALS = ["wedding", "birthday", "community"] as const;

/** theme × vertical → merged token map. */
const SCENARIOS: Array<[string, Record<string, string>]> = [
  ["light/base", tokensFor(":root")],
  ...VERTICALS.map(
    (v) =>
      [`light/${v}`, tokensFor(":root", `[data-vertical="${v}"]`)] as [
        string,
        Record<string, string>,
      ],
  ),
  ["dark/base", tokensFor(":root", ".dark")],
  ...VERTICALS.map(
    (v) =>
      [`dark/${v}`, tokensFor(":root", ".dark", `.dark [data-vertical="${v}"]`)] as [
        string,
        Record<string, string>,
      ],
  ),
];

/** sRGB hex → WCAG relative luminance. */
function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`expected 6-digit hex, got: ${hex}`);
  const n = parseInt(m[1]!, 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** [foreground, background] — SC 1.4.3 text at 4.5:1. */
const TEXT_PAIRS: Array<[string, string]> = [
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

/** Non-text UI: borders, rings, status fills — SC 1.4.11 at 3:1. */
const UI_PAIRS: Array<[string, string]> = [
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

describe.each(SCENARIOS)("theme contrast (%s)", (scenarioName, tokens) => {
  it("defines every color token used by the contract", () => {
    for (const name of [...TEXT_PAIRS.flat(), ...UI_PAIRS.flat()]) {
      expect(tokens[name], `${scenarioName} missing ${name}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each(TEXT_PAIRS)("%s on %s ≥ 4.5:1 (AA text)", (fg, bg) => {
    const ratio = contrast(tokens[fg]!, tokens[bg]!);
    expect(
      ratio,
      `${scenarioName} ${fg}(${tokens[fg]}) on ${bg}(${tokens[bg]}) = ${ratio.toFixed(2)}`,
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI_PAIRS)("%s on %s ≥ 3:1 (AA non-text)", (fg, bg) => {
    const ratio = contrast(tokens[fg]!, tokens[bg]!);
    expect(
      ratio,
      `${scenarioName} ${fg}(${tokens[fg]}) on ${bg}(${tokens[bg]}) = ${ratio.toFixed(2)}`,
    ).toBeGreaterThanOrEqual(3);
  });
});

it("per-vertical accents are actually distinct in light theme", () => {
  const [w, b, c] = ["wedding", "birthday", "community"].map(
    (v) => SCENARIOS.find(([name]) => name === `light/${v}`)![1]["--accent-a"]!,
  );
  expect(new Set([w, b, c]).size).toBe(3);
});

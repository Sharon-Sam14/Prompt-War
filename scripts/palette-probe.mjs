/** Micro contrast table for candidate palette values (design exploration only). */
function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const cr = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const BG = "#17111a";
const CARD = "#211a20";

console.log("\n-- accent-a candidates (UI ≥3:1) --");
for (const hex of ["#d05772", "#cc5570", "#c0455f", "#b8405a", "#a8354f", "#962f47"]) {
  console.log(
    `  ${hex}  on card ${cr(hex, CARD).toFixed(2)}:1   on bg ${cr(hex, BG).toFixed(2)}:1`,
  );
}

console.log("\n-- primary candidates (ivory text ≥4.5:1) --");
for (const [p, fg] of [
  ["#5b1f2a", "#fffdf9"],
  ["#6e2433", "#fffdf9"],
  ["#7a2a39", "#fffdf9"],
  ["#6e2433", "#f6f1e7"],
  ["#b79ae0", "#17111a"],
]) {
  console.log(`  ${fg} on ${p}  ${cr(fg, p).toFixed(2)}:1`);
}

console.log("\n-- ivory text candidates (≥4.5:1) --");
for (const fg of ["#f2ecf4", "#f6f1e7", "#fffdf9", "#efe6d8"]) {
  console.log(`  ${fg} on bg ${cr(fg, BG).toFixed(2)}:1   on card ${cr(fg, CARD).toFixed(2)}:1`);
}

console.log("\n-- muted-foreground candidates (≥4.5:1) --");
for (const fg of ["#b6a9bc", "#b8ab9d", "#c3b6a8", "#a99c8f"]) {
  console.log(`  ${fg} on bg ${cr(fg, BG).toFixed(2)}:1   on card ${cr(fg, CARD).toFixed(2)}:1`);
}

console.log("\n-- border / stroke candidates (UI ≥3:1 if used as a control edge) --");
for (const b of ["#3a3040", "#3a3038", "rgba ivory 0.08 (not a ratio target)"]) {
  if (b.startsWith("rgba")) {
    console.log(`  ${b}`);
    continue;
  }
  console.log(`  ${b} on bg ${cr(b, BG).toFixed(2)}:1   on card ${cr(b, CARD).toFixed(2)}:1`);
}
console.log("");

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Reads the real design tokens from index.css so this test fails if someone edits a colour badly.
const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");
const token = (name: string) => {
  const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token ${name} not found`);
  return m[1];
};

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("colour contrast (WCAG AA, 4.5:1 for text)", () => {
  const surfaces = ["#ffffff", token("paper"), token("mist"), token("mint")];
  it.each(surfaces)("main text on %s", (bg) => expect(ratio(token("ink"), bg)).toBeGreaterThanOrEqual(4.5));
  it.each(surfaces)("secondary text on %s", (bg) => expect(ratio(token("muted"), bg)).toBeGreaterThanOrEqual(4.5));
  it.each(surfaces)("deep blue text on %s", (bg) => expect(ratio(token("deep"), bg)).toBeGreaterThanOrEqual(4.5));
  it("white text on primary buttons (normal + hover)", () => {
    expect(ratio("#ffffff", token("deep"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio("#ffffff", "#2b475c")).toBeGreaterThanOrEqual(4.5);
  });
  it("safety notice text on its background", () => expect(ratio(token("care"), token("care-bg"))).toBeGreaterThanOrEqual(4.5));
  it("selected chips: white on deep", () => expect(ratio("#ffffff", token("deep"))).toBeGreaterThanOrEqual(4.5));
  it("soft blue and sage are never used for text (documented)", () => {
    // They fail as text on white, which is why they're decorative-only tokens.
    expect(ratio(token("blue"), "#ffffff")).toBeLessThan(4.5);
    expect(ratio(token("sage"), "#ffffff")).toBeLessThan(4.5);
  });
});

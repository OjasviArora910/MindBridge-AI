import axeCore from "axe-core";

/** Runs axe on a rendered container. Colour contrast is skipped because jsdom has no layout/styles;
 *  contrast is verified separately from the design tokens in contrast.test.ts. */
export async function axe(container: Element) {
  return axeCore.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
}

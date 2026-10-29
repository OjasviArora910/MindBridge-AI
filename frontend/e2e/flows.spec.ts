import { expect, test, type Page } from "@playwright/test";
import { createRequire } from "node:module";

// NOTE: these specs were written but could not be executed in the build sandbox (no browser available).
// Run them locally with: npx playwright install chromium && npm run e2e

const require = createRequire(import.meta.url);

async function guestToHome(page: Page) {
  await page.goto("/");
  await page.getByRole("link", { name: "Let's get started" }).click();
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page.getByText("Question 1 of 4")).toBeVisible();
}

async function finishOnboarding(page: Page) {
  await page.getByRole("radio", { name: "6" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("checkbox", { name: "Overwhelmed" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: "Studies or exams" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Skip" }).click(); // optional duration
  await page.getByRole("radio", { name: /Save my answers/ }).click();
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByText(/especially around your studies/)).toBeVisible();
}

test("onboarding gives a personalized welcome without any diagnosis", async ({ page }) => {
  await guestToHome(page);
  await finishOnboarding(page);
  await expect(page.locator("body")).not.toContainText(/depress|disorder|diagnos(is|ed)/i);
  await page.getByRole("button", { name: "Not now, take me home" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("mood check-in is saved and appears in recent check-ins", async ({ page }) => {
  await guestToHome(page);
  await finishOnboarding(page);
  await page.getByRole("button", { name: "Not now, take me home" }).click();
  await page.getByRole("link", { name: /Mood/ }).first().click();
  await page.getByRole("radio", { name: "4" }).click();
  await page.getByLabel(/Hours slept/).fill("6.5");
  await page.getByRole("button", { name: "Save check-in" }).click();
  await expect(page.getByText("Saved. Thanks for checking in.")).toBeVisible();
  await expect(page.getByText(/· 4\/10/)).toBeVisible();
});

test("SOS exercise needs Begin, can pause, and can be exited", async ({ page }) => {
  await page.goto("/calm"); // public: no account needed
  await page.getByRole("button", { name: "Start Paced breathing" }).click();
  await expect(page.getByRole("button", { name: "Begin" })).toBeVisible();
  await page.getByRole("button", { name: "Begin" }).click();
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  await page.getByRole("button", { name: "Exit" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("risk language shows the reviewed safety response with support options", async ({ page }) => {
  await guestToHome(page);
  await finishOnboarding(page);
  await page.getByRole("button", { name: "Not now, take me home" }).click();
  await page.getByRole("link", { name: /Talk/ }).first().click();
  await page.getByLabel("Message").fill("I can't go on like this");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Support options").first()).toBeVisible();
  await expect(page.getByText(/can't contact anyone for you/).first()).toBeVisible();
});

test("support is reachable from the landing page without signing in", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Need support now?" }).click();
  await expect(page.getByRole("dialog", { name: "Support options" })).toBeVisible();
  await expect(page.getByText(/We don't guess where you are/)).toBeVisible();
});

test("no horizontal overflow on key pages (checks mobile and desktop projects)", async ({ page }) => {
  for (const path of ["/", "/start", "/calm"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
  }
});

test("real-browser accessibility scan including colour contrast", async ({ page }) => {
  await page.goto("/");
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const result = await page.evaluate(async () => {
    // @ts-expect-error axe is injected above
    const r = await window.axe.run(document);
    return r.violations.map((v: { id: string; nodes: unknown[] }) => ({ id: v.id, count: v.nodes.length }));
  });
  expect(result).toEqual([]);
});

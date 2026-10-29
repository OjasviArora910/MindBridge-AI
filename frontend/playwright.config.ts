import { defineConfig, devices } from "@playwright/test";

// End-to-end tests start a throwaway backend (SQLite file, mock LLM) and the Vite dev server.
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  retries: 0,
  use: { baseURL: "http://localhost:5173", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "rm -f /tmp/mindbridge-e2e.db && cd ../backend && DATABASE_URL=sqlite:////tmp/mindbridge-e2e.db LLM_PROVIDER=mock CHAT_RATE_LIMIT_PER_MINUTE=1000 python -m uvicorn app.main:app --port 8000",
      url: "http://localhost:8000/health",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    { command: "npm run dev", url: "http://localhost:5173", reuseExistingServer: true, timeout: 60_000 },
  ],
});

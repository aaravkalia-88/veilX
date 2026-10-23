import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:8000",
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      ".venv/bin/python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --no-access-log",
    url: "http://127.0.0.1:8000/healthz",
    reuseExistingServer: true,
  },
});

// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './specs',
  timeout: 30000,
  retries: 0,
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: '../results/playwright-report.json' }],
    ['html', { outputFolder: '../results/playwright-html', open: 'never' }],
  ],
  use: {
    baseURL: process.env.CRM_BASE_URL || 'http://127.0.0.1:8299',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
});

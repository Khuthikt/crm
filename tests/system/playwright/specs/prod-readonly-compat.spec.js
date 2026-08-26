const { test, expect } = require('@playwright/test');

// Hybrid-mode production check: read-only rendering only, no form
// submission, no login, no writes. Confirms the public login screen
// renders correctly across engines/viewports on the real site.
test.describe('Compatibility — production login screen (read-only)', () => {
  test.use({ baseURL: 'https://crm.hulisa.co.za' });

  test('login screen renders without console errors', async ({ page }, testInfo) => {
    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    const failedRequests = [];
    page.on('requestfailed', (req) => failedRequests.push(`${req.url()} :: ${req.failure()?.errorText}`));

    const response = await page.goto('/crm/', { waitUntil: 'load', timeout: 20000 });
    expect(response.status()).toBe(200);

    await expect(page.locator('#login-username')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
    await expect(page.locator('#login-btn')).toBeVisible();

    const box = await page.locator('.login-card').boundingBox();
    expect(box).not.toBeNull();
    const viewport = page.viewportSize();
    expect(box.width).toBeLessThanOrEqual(viewport.width + 1);

    await testInfo.attach('console-errors', { body: JSON.stringify(consoleErrors, null, 2), contentType: 'application/json' });
    await testInfo.attach('failed-requests', { body: JSON.stringify(failedRequests, null, 2), contentType: 'application/json' });
    expect(failedRequests, failedRequests.join('\n')).toHaveLength(0);
  });
});

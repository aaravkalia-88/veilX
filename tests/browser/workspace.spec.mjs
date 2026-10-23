import { test, expect } from '@playwright/test';

const draft = "Hi, I'm Maya Sharma. Email maya@example.com. Phone +91 98765 43210. Authorization: Bearer synthetic_private_credential_0123456789";

test('private round trip stays local and only aggregate counts reach real MCP', async ({ page }) => {
  const posts = [];
  page.on('request', r => { if (r.method() === 'POST') posts.push(r.postData() || ''); });
  await page.goto('/');
  await page.getByLabel('Private draft').fill(draft);
  await page.getByRole('button', { name: 'Mask all', exact: true }).click();
  const protectedText = page.locator('#protected-text');
  await expect(protectedText).toContainText('[PERSON_1]');
  await expect(protectedText).not.toContainText('maya@example.com');
  await expect(protectedText).not.toContainText('synthetic_private_credential');
  expect(posts).toEqual([]);
  await page.getByLabel('AI reply (masked)').fill('Hi [PERSON_1]. Email [EMAIL_1]. Credential [SECRET_1].');
  await page.getByRole('button', { name: 'Restore locally', exact: true }).click();
  await expect(page.locator('#restored-text')).toContainText('Maya Sharma');
  await expect(page.locator('#restored-text')).toContainText('maya@example.com');
  await expect(page.locator('#restored-text')).toContainText('[SECRET_1]');
  await page.getByRole('button', { name: 'Summarize this protection' }).click();
  await expect(page.locator('#assistant-result')).toContainText('VeilX masked');
  expect(posts.length).toBe(1);
  for (const body of posts) {
    expect(body).not.toContain('Maya');
    expect(body).not.toContain('maya@example.com');
    expect(body).not.toContain('synthetic_private');
    expect(Object.keys(JSON.parse(body)).sort()).toEqual(['counts_by_type', 'intent', 'unresolved_count']);
  }
  await page.getByRole('button', { name: 'Clear session', exact: true }).click();
  await page.getByLabel('AI reply (masked)').fill('[PERSON_1] [EMAIL_1]');
  await page.getByRole('button', { name: 'Restore locally', exact: true }).click();
  await expect(page.locator('#restored-text')).toHaveText('[PERSON_1] [EMAIL_1]');
});

test('manual marking, undo and safe literal rendering work', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Private draft').fill('🔒 Zqx Vrn <img src=x onerror=alert(1)>');
  await page.getByLabel('Private draft').evaluate(el => { el.focus(); el.setSelectionRange(3, 10); });
  await page.getByRole('button', { name: 'Mark selection', exact: true }).click();
  await page.getByRole('button', { name: 'Mask all', exact: true }).click();
  await expect(page.locator('#protected-text')).toContainText('[PERSON_1]');
  await expect(page.locator('#protected-text')).toContainText('<img');
  expect(await page.locator('#protected-text img').count()).toBe(0);
  await page.getByRole('button', { name: 'Undo masking', exact: true }).click();
  await expect(page.getByLabel('Private draft')).toHaveValue('🔒 Zqx Vrn <img src=x onerror=alert(1)>');
  await expect(page.locator('#protected-text')).toContainText('Your protected text appears here');
});

test('responsive layout, native popover keyboard dismissal and downloadable package', async ({ page, request }) => {
  await page.goto('/');
  await page.getByLabel('Private draft').fill('maya@example.com');
  await page.getByRole('button', { name: /Review \d+ finding/ }).click();
  await expect(page.locator('#findings-popover')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#findings-popover')).not.toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const response = await request.get('/download/veilx-extension.zip');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('application/zip');
});

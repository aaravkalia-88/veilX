import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';

for (const variant of ['', '?guest=1']) test(`loaded MV3 extension masks and restores only in its own panel (${variant || 'legacy'})`, async () => {
  const extension = path.resolve('dist/extension');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const fixture = await context.newPage();
    await fixture.goto(`http://127.0.0.1:8000/assets/fixture.html${variant}`);
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/panel.html`);
    await panel.getByRole('button', { name: 'Connect current site' }).click();
    await expect(panel.locator('#connection-status')).toContainText('connected.');
    await panel.getByLabel('Private draft').fill("Hi, I'm Maya Sharma. Email maya@example.com. Authorization: Bearer synthetic_private_credential_0123456789");
    await panel.getByRole('button', { name: 'Mask all', exact: true }).click();
    await panel.getByRole('button', { name: 'Send protected to ChatGPT' }).click();
    await expect(fixture.locator('#submitted-text')).toContainText('[PERSON_1]');
    await expect(fixture.locator('#submitted-text')).not.toContainText('Maya Sharma');
    await expect(fixture.locator('#submitted-text')).not.toContainText('maya@example.com');
    await expect(fixture.locator('#submitted-text')).not.toContainText('synthetic_private_credential');
    await expect(panel.locator('#restored-text')).toContainText('Maya Sharma', { timeout: 15000 });
    await expect(panel.locator('#restored-text')).toContainText('maya@example.com');
    await expect(panel.locator('#restored-text')).toContainText('[SECRET_1]');
    await expect(fixture.locator('[data-message-author-role="assistant"], [data-message-role="assistant"]')).not.toContainText('Maya Sharma');
    await panel.getByRole('button', { name: 'Clear session', exact: true }).click();
    await panel.getByLabel('AI reply (masked)').fill('[PERSON_1] [EMAIL_1]');
    await panel.getByRole('button', { name: 'Restore locally' }).click();
    await expect(panel.locator('#restored-text')).toHaveText('[PERSON_1] [EMAIL_1]');
    const privateMapEmpty = await worker.evaluate(async () => Object.values(await chrome.storage.session.get(null)).every(record => !record.session.entries.length));
    expect(privateMapEmpty).toBe(true);
    await fixture.close();
    await expect(panel.locator('#connection-status')).toContainText('tab closed');
  } finally { await context.close(); }
});

test('real MCP HTTP handshake supports the required version and exposes working tools', async ({ request }) => {
  const headers = { Accept: 'application/json, text/event-stream' };
  const init = await request.post('/mcp', { headers, data: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'veilx-acceptance', version: '1.0' } } } });
  expect(init.ok()).toBe(true);
  expect((await init.json()).result.protocolVersion).toBe('2025-11-25');
  const result = await request.post('/mcp', { headers: { ...headers, 'Mcp-Protocol-Version': '2025-11-25' }, data: { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'summarize_protection', arguments: { counts_by_type: { email: 2, secret: 1 }, unresolved_count: 0 } } } });
  expect(result.ok()).toBe(true);
  const output = (await result.json()).result.structuredContent;
  expect(output.total_masked).toBe(3);
  expect(output.credentials_masked).toBe(1);
});

test('site hints exclude sensitive fields, preserve drafts, and never restore interrupted replies', async () => {
  const extension = path.resolve('dist/extension');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const fixture = await context.newPage();
    await fixture.goto('http://127.0.0.1:8000/assets/fixture.html');
    // Exercise the second composer variant actually observed on guest ChatGPT.
    await fixture.locator('#prompt-textarea').evaluate(el => { el.id = 'mobile-composer-prompt'; });
    await fixture.locator('[data-testid="send-button"]').evaluate(el => { el.removeAttribute('data-testid'); el.setAttribute('aria-label', 'Send message'); });
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${new URL(worker.url()).host}/panel.html`);
    await panel.getByRole('button', { name: 'Connect current site' }).click();
    await expect(panel.locator('#connection-status')).toContainText('connected.');
    await fixture.locator('#mobile-composer-prompt').focus();
    await expect(fixture.locator('#veilx-hints')).toBeVisible();
    const tab = await worker.evaluate(async () => (await chrome.tabs.query({ url: 'http://127.0.0.1:8000/assets/fixture.html' }))[0].id);
    expect(await worker.evaluate(async tabId => (await chrome.scripting.executeScript({ target: { tabId }, func: async () => { try { await chrome.storage.session.get(null); return 'accessible'; } catch { return 'denied'; } } }))[0].result, tab)).toBe('denied');
    await fixture.evaluate(() => {
      for (const [id, type, autocomplete] of [['password', 'password', 'current-password'], ['otp', 'text', 'one-time-code'], ['card', 'text', 'cc-number'], ['date', 'date', '']]) {
        const field = document.createElement('input'); Object.assign(field, { id, type, autocomplete }); document.body.append(field);
      }
    });
    for (const id of ['password', 'otp', 'card', 'date']) {
      await fixture.locator(`#${id}`).focus();
      await expect(fixture.locator('#veilx-hints')).toBeHidden();
    }
    await panel.getByLabel('Pause hints').check();
    await fixture.locator('#mobile-composer-prompt').focus();
    await expect(fixture.locator('#veilx-hints')).toBeHidden();
    await panel.getByLabel('Pause hints').uncheck();
    await fixture.locator('#mobile-composer-prompt').fill('An existing provider draft');
    await panel.getByLabel('Private draft').fill('Email maya@example.com.');
    await panel.getByRole('button', { name: 'Mask all', exact: true }).click();
    await panel.getByRole('button', { name: 'Send protected to ChatGPT' }).click();
    await expect(panel.locator('#workspace-status')).toContainText('already has a draft');
    await expect(fixture.locator('#mobile-composer-prompt')).toHaveValue('An existing provider draft');
    await fixture.locator('#mobile-composer-prompt').fill('');
    await panel.getByRole('button', { name: 'Send protected to ChatGPT' }).click();
    await fixture.getByRole('button', { name: 'Stop generating' }).click();
    await expect(panel.locator('#workspace-status')).toContainText('interrupted', { timeout: 10000 });
    await expect(panel.locator('#restored-text')).not.toContainText('maya@example.com');
    await expect(fixture.locator('[data-message-author-role="assistant"], [data-message-role="assistant"]')).toContainText('[EMAIL_1]');
    await fixture.goto('http://127.0.0.1:8000/assets/fixture.html?next=1');
    // Same conversation path retains its map; a new path clears it.
    await fixture.goto('http://127.0.0.1:8000/');
    await expect.poll(async () => worker.evaluate(async () => Object.keys(await chrome.storage.session.get(null)).length)).toBe(0);
  } finally { await context.close(); }
});

test('activating the extension veils the site editor and restores a normally submitted reply', async () => {
  const extension = path.resolve('dist/extension');
  const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const fixture = await context.newPage();
    await fixture.goto('http://127.0.0.1:8000/assets/fixture.html?guest=1');
    await fixture.getByLabel('Website composer').fill('hi my name is sophia');
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${new URL(worker.url()).host}/panel.html`);
    await panel.getByRole('button', { name: 'Connect current site' }).click();
    await expect(fixture.getByLabel('Website composer')).toHaveValue('hi my name is [PERSON_1]');
    await expect(panel.getByLabel('Private draft')).toHaveValue('hi my name is sophia');
    await fixture.getByLabel('Website composer').fill('hi my name is [PERSON_1]. Email maya@example.com.');
    await expect(fixture.getByLabel('Website composer')).toHaveValue('hi my name is [PERSON_1]. Email [EMAIL_1].');
    await fixture.getByRole('button', { name: 'Send message' }).click();
    await expect(panel.locator('#restored-text')).toContainText('sophia', { timeout: 15000 });
    await expect(panel.locator('#restored-text')).toContainText('maya@example.com');
    await expect(fixture.locator('[data-message-role="assistant"]')).not.toContainText('sophia');
  } finally { await context.close(); }
});

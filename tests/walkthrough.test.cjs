const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const file = path.join(__dirname, '../index.html');
const html = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const core = html.match(/<script id="walkthrough-core">([\s\S]*?)<\/script>/)?.[1] || '';
const context = vm.createContext({});
vm.runInContext(core, context, { filename: 'walkthrough-core.js' });
const run = source => vm.runInContext(source, context);

test('personal sample replaces every repeated value with consistent placeholders', () => {
  assert.equal(run("redactSample('personal').includes('Maya Chen')"), false);
  assert.equal(run("redactSample('personal').includes('maya@example.com')"), false);
  assert.equal(run("redactSample('personal').match(/\\[PERSON_1\\]/g).length"), 2);
});

test('reply restoration is local, repeatable, and leaves unknown placeholders alone', () => {
  assert.equal(run("restoreSample('personal', '[PERSON_1], email [EMAIL_1]. [PERSON_2] / [PERSON_1]')"),
    'Maya Chen, email maya@example.com. [PERSON_2] / Maya Chen');
  assert.equal(run("restoreSample('personal', 'Partial [PERSON_')"), 'Partial [PERSON_');
});

test('synthetic session values never appear in the redacted cookie sample', () => {
  assert.equal(run("redactSample('cookie').includes('fictional-session-value')"), false);
  assert.equal(run("redactSample('cookie').includes('[SESSION_1]')"), true);
});

test('only verified no-training maps to low; unclear or unknown fails to strict', () => {
  assert.equal(run("scorePolicy('yes_by_default').risk"), 'High');
  assert.equal(run("scorePolicy('unclear').mode"), 'Strict');
  assert.equal(run("scorePolicy('not-a-valid-answer').risk"), 'High');
  assert.equal(run("scorePolicy('opt_out_available').risk"), 'Medium');
  assert.equal(run("scorePolicy('no').risk"), 'Low');
});

test('cookie guard blocks only the illustrated known tracker when enabled', () => {
  assert.equal(run("cookieDecision(true, 'known-tracker')"), 'blocked');
  assert.equal(run("cookieDecision(false, 'known-tracker')"), 'allowed');
  assert.equal(run("cookieDecision(true, 'first-party')"), 'allowed');
  assert.equal(run("cookieDecision(true, 'unknown-destination')"), 'allowed');
});

test('artifact has no external assets, outbound API, or persistent browser storage', () => {
  assert.ok(html.includes('id="walkthrough-core"'), 'Standalone walkthrough is implemented');
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|@import|fetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(html, /on(?:click|load|error)\s*=/i);
  assert.match(html, /connect-src 'none'/);
});

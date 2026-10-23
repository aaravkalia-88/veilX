import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, detect, maskText, restoreText, clearSession, eligibleField, SESSION_TTL } from '../../shared/privacy.mjs';

test('recognizes real local suggestions and masks repeated personal values consistently', () => {
  const text = "Hi, I'm Maya Sharma. Email maya@example.com or call +91 98765 43210. Maya Sharma lives at 18 Example Road, Delhi.";
  const session = createSession('chat-a');
  const result = maskText(text, session);
  for (const value of ['Maya Sharma', 'maya@example.com', '+91 98765 43210', '18 Example Road']) assert.ok(!result.maskedText.includes(value), value);
  assert.match(result.maskedText, /\[PERSON_1\]/);
  assert.equal(restoreText(result.maskedText, session), text);
  assert.equal(maskText(text, session).maskedText, result.maskedText);
  assert.equal(result.counts.email, 1);
});

test('an email containing a person name is one non-overlapping finding', () => {
  const findings = detect('Email John.Smith@example.com.');
  assert.equal(findings.filter(f => f.type === 'email').length, 1);
  for (let i = 1; i < findings.length; i++) assert.ok(findings[i - 1].end <= findings[i].start);
});

test('reserves literal placeholders, restores exact known tokens, and preserves partial/unknown tokens', () => {
  const session = createSession('chat-a');
  const result = maskText('[EMAIL_1] maya@example.com', session);
  assert.equal(result.maskedText, '[EMAIL_1] [EMAIL_2]');
  assert.equal(restoreText('[EMAIL_1] [EMAIL_2] [EMAIL_20] [EMAIL_', session), '[EMAIL_1] maya@example.com [EMAIL_20] [EMAIL_');
});

test('credentials and pasted sessions are masked and never restored, including manual reclassification', () => {
  const text = 'Authorization: Bearer synthetic_private_credential_0123456789';
  const session = createSession('chat-a');
  const result = maskText(text, session, { manual: [{ start: 22, end: text.length, type: 'person' }] });
  assert.ok(!result.maskedText.includes('synthetic_private_credential'));
  assert.equal(restoreText(result.maskedText, session), result.maskedText);
  assert.ok(result.findings.some(f => ['secret', 'session_token'].includes(f.type)));
});

test('manual marking uses UTF-16 offsets without damaging emoji or surrounding punctuation', () => {
  const text = '🔒 Reach Zqx Vrn tomorrow.';
  const start = text.indexOf('Zqx Vrn');
  const session = createSession('chat-a');
  const result = maskText(text, session, { manual: [{ start, end: start + 7, type: 'person' }] });
  assert.equal(result.maskedText, '🔒 Reach [PERSON_1] tomorrow.');
  assert.equal(restoreText(result.maskedText, session), text);
});

test('scope, inactivity, and clear prevent reuse of an old map', () => {
  const session = createSession('chat-a', 100);
  maskText('maya@example.com', session, { now: 100 });
  assert.throws(() => restoreText('[EMAIL_1]', session, { scope: 'chat-b', now: 100 }), /session|scope/i);
  assert.throws(() => restoreText('[EMAIL_1]', session, { now: 100 + SESSION_TTL }), /expired/i);
  assert.equal(session.entries.length, 0);
  const fresh = createSession('chat-a');
  maskText('maya@example.com', fresh);
  clearSession(fresh);
  assert.equal(fresh.entries.length, 0);
  assert.equal(restoreText('[EMAIL_1]', createSession('chat-b')), '[EMAIL_1]');
});

test('ordinary numbers and dates stay intact; contextual DOB, IDs and validated cards are flagged', () => {
  assert.equal(detect('We need 12 chairs by 2026-10-23. Budget 4000.').length, 0);
  const types = detect('DOB: 1997-04-23. PAN: ABCDE1234F. Card: 4111 1111 1111 1111.').map(f => f.type);
  for (const type of ['dob', 'id', 'card']) assert.ok(types.includes(type), type);
});

test('validates manual spans and input limits at the boundary', () => {
  const s = createSession('a');
  assert.throws(() => detect('x'.repeat(20001)), /long|limit/i);
  assert.throws(() => detect(null), /text|string/i);
  assert.throws(() => maskText('abc', s, { manual: [{ start: -1, end: 8, type: 'person' }] }), /span|range/i);
  assert.throws(() => maskText('abc', s, { manual: [{ start: 0, end: 2, type: 'unknown' }] }), /type|span/i);
});

test('only prose surfaces are eligible; credentials, OTPs and payment fields stay untouched', () => {
  assert.equal(eligibleField({ tag: 'TEXTAREA' }), true);
  assert.equal(eligibleField({ tag: 'DIV', editable: true }), true);
  for (const field of [
    { tag: 'INPUT', type: 'password' }, { tag: 'INPUT', type: 'email' },
    { tag: 'INPUT', type: 'text', autocomplete: 'one-time-code' },
    { tag: 'TEXTAREA', label: 'credit card number' },
    { tag: 'TEXTAREA', sensitiveContainer: true }, { tag: 'TEXTAREA', disabled: true },
    { tag: 'TEXTAREA', readOnly: true }, { tag: 'DIV', editable: false },
  ]) assert.equal(eligibleField(field), false, JSON.stringify(field));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scopeFor, transitionScope, supportedUrl } from '../../shared/scope.mjs';

test('scopes bind to one tab and conversation without queries or fragments', () => {
  assert.equal(scopeFor(3, 'https://chatgpt.com/c/abc?private=secret#x'), '3|https://chatgpt.com|/c/abc');
  assert.notEqual(scopeFor(3, 'https://chatgpt.com/c/abc'), scopeFor(4, 'https://chatgpt.com/c/abc'));
  assert.equal(supportedUrl('https://chatgpt.com.evil.example/'), false);
  assert.equal(supportedUrl('https://chatgpt.com/auth/login'), false);
  assert.equal(supportedUrl('http://127.0.0.1:8000/assets/fixture.html'), true);
  assert.equal(supportedUrl('chrome://extensions'), false);
});

test('only a pending first ChatGPT reply can bind the initial conversation URL', () => {
  const scope = scopeFor(3, 'https://chatgpt.com/');
  assert.equal(transitionScope({ scope, pending: true }, 3, 'https://chatgpt.com/c/new'), 'bind');
  assert.equal(transitionScope({ scope, pending: false }, 3, 'https://chatgpt.com/c/new'), 'clear');
  assert.equal(transitionScope({ scope: scopeFor(3, 'https://chatgpt.com/c/old'), pending: true }, 3, 'https://chatgpt.com/c/new'), 'clear');
  assert.equal(transitionScope({ scope, pending: false }, 3, 'https://chatgpt.com/?x=1'), 'keep');
  assert.equal(transitionScope({ scope, pending: true }, 3, 'https://evil.example/'), 'clear');
});

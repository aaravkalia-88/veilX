const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const file = path.join(__dirname, '../index.html');
let html = fs.readFileSync(file, 'utf8');
const digest = value => `'sha256-${createHash('sha256').update(value).digest('base64')}'`;
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(match => digest(match[1]));
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => digest(match[1]));
if (scripts.length !== 2 || styles.length !== 1) throw new Error('Expected two scripts and one style block.');
html = html.replace(/script-src [^;]+;/, `script-src ${scripts.join(' ')};`)
  .replace(/style-src [^;]+;/, `style-src ${styles.join(' ')};`);
fs.writeFileSync(file, html);
console.log('HTML policy hashes refreshed.');

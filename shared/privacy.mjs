import nlp from 'compromise';

export const TYPES = Object.freeze({
  person: 'PERSON', address: 'ADDRESS', email: 'EMAIL', phone: 'PHONE',
  id: 'ID', dob: 'DOB', card: 'CARD', secret: 'SECRET', session_token: 'SESSION_TOKEN',
});
export const LABELS = Object.freeze({ person: 'Name', address: 'Address', email: 'Email', phone: 'Phone', id: 'Identifier', dob: 'Birth date', card: 'Payment card', secret: 'Secret', session_token: 'Session credential' });
export const SESSION_TTL = 30 * 60 * 1000;
export const MAX_TEXT = 20000;
const TOKEN = /\[(?:PERSON|ADDRESS|EMAIL|PHONE|ID|DOB|CARD|SECRET|SESSION_TOKEN)_\d+\]/g;
const CREDENTIALS = new Set(['secret', 'session_token']);

function checkText(text) {
  if (typeof text !== 'string') throw new TypeError('Text must be a string.');
  if (text.length > MAX_TEXT) throw new RangeError('Text is too long. The limit is 20,000 characters.');
}

export function createSession(scope, now = Date.now()) {
  if (typeof scope !== 'string' || !scope || scope.length > 300) throw new TypeError('A valid session scope is required.');
  return { id: crypto.randomUUID(), scope, lastUsed: now, entries: [], reserved: [], counters: {} };
}

export function clearSession(session) {
  session.entries = [];
  session.reserved = [];
  session.counters = {};
  session.lastUsed = 0;
}

function checkSession(session, scope, now) {
  if (!session || !Array.isArray(session.entries) || session.scope !== scope) throw new Error('This map belongs to a different session scope.');
  if (now < session.lastUsed || now - session.lastUsed >= SESSION_TTL) {
    clearSession(session);
    throw new Error('The private session expired. Start a new session.');
  }
}

function validCard(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  for (let i = digits.length - 1, double = false; i >= 0; i--, double = !double) {
    let digit = Number(digits[i]);
    if (double && (digit *= 2) > 9) digit -= 9;
    sum += digit;
  }
  return sum % 10 === 0;
}

export function detect(text, manual = []) {
  checkText(text);
  const candidates = [];
  const add = (start, end, type, priority, reason) => {
    if (start < end) candidates.push({ start, end, type, priority, reason, confidence: priority < 3 ? 'pattern' : 'suggestion', id: `${type}:${start}:${end}` });
  };
  const matches = (regex, type, priority, reason, group = 0, accept = () => true) => {
    for (const match of text.matchAll(regex)) {
      const value = match[group];
      const start = match.index + (group ? match[0].indexOf(value) : 0);
      if (accept(value)) add(start, start + value.length, type, priority, reason);
    }
  };
  matches(/\bBearer\s+([A-Za-z0-9._~+/=-]{12,4096})/gi, 'secret', 0, 'A bearer credential can grant access to an account.', 1);
  matches(/\b(?:Cookie|Set-Cookie|Session(?:[_ -]?(?:ID|Token))?)\s*[:=]\s*([^\r\n]{8,4096})/gi, 'session_token', 0, 'Possible session credential. It will never be restored.', 1);
  matches(/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g, 'session_token', 0, 'JWT-shaped session material. It will never be restored.');
  matches(/\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{12,200}|gh[pousr]_[A-Za-z0-9]{15,200}|AKIA[A-Z0-9]{16})\b/g, 'secret', 0, 'Possible API credential. It will never be restored.');
  matches(/\b(?:api[_ -]?key|password|access[_ -]?token)\s*[:=]\s*([^\s,;]{8,4096})/gi, 'secret', 0, 'A credential was pasted into prose.', 1);
  for (const span of manual) {
    if (!Object.hasOwn(TYPES, span.type) || !Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < 0 || span.end > text.length || span.start >= span.end) throw new RangeError('Invalid manual span or type.');
    add(span.start, span.end, span.type, CREDENTIALS.has(span.type) ? 0 : 1, 'Marked private by you.');
  }
  matches(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b/gi, 'email', 2, 'An email address can identify or contact someone.');
  matches(/\+\d[\d ()-]{7,23}\d/g, 'phone', 2, 'Possible international phone number.', 0, value => { const n = value.replace(/\D/g, '').length; return n >= 10 && n <= 15; });
  matches(/\b(?:[6-9]\d{9}|\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4})\b/g, 'phone', 2, 'Possible Indian or North American phone number.');
  matches(/\b(?:\d[ -]?){12,18}\d\b/g, 'card', 2, 'Card-shaped number with a valid Luhn checksum.', 0, validCard);
  matches(/\b(?:DOB|date of birth|born on)\s*[:=]?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})\b/gi, 'dob', 2, 'A date was explicitly described as a birth date.', 1);
  matches(/\b(?:PAN|SSN|Aadhaar|government ID)\s*[:=]?\s*([A-Z]{5}\d{4}[A-Z]|\d{3}-\d{2}-\d{4}|\d{4}[ -]?\d{4}[ -]?\d{4})\b/gi, 'id', 2, 'An identifier pattern appears next to an identifying label.', 1);
  matches(/\b(?:I live at|lives at|my address is|address\s*:)\s*([^\n.!?]{4,140})/gi, 'address', 2, 'An address was explicitly introduced in this sentence.', 1);
  matches(/\b(?:my name is|I am|I'm)\s+([\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+){1,3})/gu, 'person', 3, 'Possible name introduced in context. Please review.', 1);
  const doc = nlp(text);
  for (const [selection, type] of [[doc.people(), 'person'], [doc.addresses(), 'address']]) {
    for (const item of selection.json({ offset: true })) {
      const first = item.terms[0];
      const last = item.terms.at(-1);
      if (first?.offset && last?.offset) add(first.offset.start, last.offset.start + last.text.length, type, 3, `Possible ${LABELS[type].toLowerCase()}. Local language rules can miss or misclassify text.`);
    }
  }
  const selected = [];
  candidates.sort((a, b) => a.priority - b.priority || (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  for (const finding of candidates) {
    if (!selected.some(other => finding.start < other.end && finding.end > other.start)) selected.push(finding);
  }
  return selected.sort((a, b) => a.start - b.start);
}

export function maskText(text, session, { manual = [], ignored = [], now = Date.now(), scope = session?.scope } = {}) {
  checkText(text);
  checkSession(session, scope, now);
  const findings = detect(text, manual).filter(f => !ignored.includes(f.id));
  for (const token of text.match(TOKEN) || []) {
    if (session.entries.some(entry => entry.placeholder === token)) throw new Error('This input contains a token already used by this session. Clear the session before treating it as literal text.');
    if (!session.reserved.includes(token)) session.reserved.push(token);
  }
  const counts = Object.fromEntries(Object.keys(TYPES).map(type => [type, 0]));
  for (const finding of findings) {
    const original = text.slice(finding.start, finding.end);
    let entry = session.entries.find(e => e.type === finding.type && e.original === original);
    if (!entry) {
      if (session.entries.length >= 500) throw new Error('Session map limit reached. Start a new session.');
      let placeholder;
      do {
        session.counters[finding.type] = (session.counters[finding.type] || 0) + 1;
        placeholder = `[${TYPES[finding.type]}_${session.counters[finding.type]}]`;
      } while (session.reserved.includes(placeholder));
      entry = { original, placeholder, type: finding.type, restorable: !CREDENTIALS.has(finding.type) };
      session.entries.push(entry);
    }
    finding.placeholder = entry.placeholder;
    counts[finding.type]++;
  }
  let maskedText = text;
  for (const finding of [...findings].reverse()) maskedText = maskedText.slice(0, finding.start) + finding.placeholder + maskedText.slice(finding.end);
  session.lastUsed = now;
  return { maskedText, findings, counts, unresolvedCount: 0 };
}

export function restoreText(text, session, { scope = session?.scope, now = Date.now() } = {}) {
  checkText(text);
  checkSession(session, scope, now);
  const entries = new Map(session.entries.filter(e => e.restorable && !CREDENTIALS.has(e.type)).map(e => [e.placeholder, e.original]));
  session.lastUsed = now;
  return text.replace(TOKEN, token => entries.get(token) ?? token);
}

export function eligibleField({ tag, type = 'text', autocomplete = '', label = '', editable = false, disabled = false, readOnly = false, sensitiveContainer = false }) {
  if (disabled || readOnly || sensitiveContainer || /password|passwd|one.time|otp|verification|authenticat|credit.?card|payment|card.?number|cc-|cvv|cvc|secret|security.?code/i.test(`${autocomplete} ${label}`)) return false;
  return tag === 'TEXTAREA' || (tag === 'INPUT' && ['text', 'search'].includes(type)) || editable;
}

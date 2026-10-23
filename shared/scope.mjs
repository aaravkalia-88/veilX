export function supportedUrl(value) {
  try {
    const url = new URL(value);
    if (
      /\/(?:auth|login|signin|signup|checkout|payment)(?:\/|$)/i.test(
        url.pathname,
      )
    )
      return false;
    if (url.protocol === "https:" && url.hostname === "chatgpt.com")
      return (
        url.pathname === "/" || /^\/(?:c|uc)\/[\w-]+\/?$/.test(url.pathname)
      );
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export function scopeFor(tabId, value) {
  if (!Number.isInteger(tabId) || tabId < 0 || !supportedUrl(value))
    throw new Error("Unsupported tab. Open ChatGPT or the local VeilX demo.");
  const url = new URL(value);
  return `${tabId}|${url.origin}|${url.pathname}`;
}

export function transitionScope(record, tabId, value) {
  if (!supportedUrl(value)) return "clear";
  const next = scopeFor(tabId, value);
  if (next === record.scope) return "keep";
  if (
    (record.pending || record.completedInitialReply) &&
    record.scope === `${tabId}|https://chatgpt.com|/` &&
    /^\/(?:c|uc)\/[\w-]+\/?$/.test(new URL(value).pathname)
  )
    return "bind";
  return "clear";
}

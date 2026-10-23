import {
  createSession,
  maskText,
  SESSION_TTL,
  TYPES,
} from "../shared/privacy.mjs";
import { scopeFor, supportedUrl, transitionScope } from "../shared/scope.mjs";

const keyFor = (tabId) => `veilx:${tabId}`;
let queue = Promise.resolve();
const serial = (fn) => {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {});
  return next;
};
const trustedPanel = (sender) =>
  sender.id === chrome.runtime.id &&
  sender.url === chrome.runtime.getURL("panel.html");

chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
chrome.alarms.create("veilx-expiry", { periodInMinutes: 1 });

async function load(tabId) {
  const key = keyFor(tabId);
  const record = (await chrome.storage.session.get(key))[key];
  if (
    record &&
    (Date.now() - record.session.lastUsed >= SESSION_TTL ||
      Date.now() < record.session.lastUsed)
  ) {
    await chrome.storage.session.remove(key);
    return null;
  }
  return record;
}

function validSession(session, scope) {
  return (
    session &&
    session.scope === scope &&
    typeof session.id === "string" &&
    session.id.length < 100 &&
    Number.isFinite(session.lastUsed) &&
    Array.isArray(session.entries) &&
    session.entries.length <= 500 &&
    Array.isArray(session.reserved) &&
    session.counters &&
    !Array.isArray(session.counters) &&
    typeof session.counters === "object" &&
    JSON.stringify(session).length < 200000 &&
    session.entries.every(
      (e) =>
        Object.hasOwn(TYPES, e.type) &&
        typeof e.original === "string" &&
        e.original.length <= 20000 &&
        new RegExp(`^\\[${TYPES[e.type]}_\\d+\\]$`).test(e.placeholder) &&
        typeof e.restorable === "boolean" &&
        (!["secret", "session_token"].includes(e.type) || !e.restorable),
    )
  );
}

async function handle(message, sender) {
  if (!trustedPanel(sender) || !Number.isInteger(message.tabId))
    throw new Error("Untrusted extension message.");
  const key = keyFor(message.tabId);
  if (message.type === "CLEAR") {
    await chrome.storage.session.remove(key);
    return { cleared: true };
  }
  const tab = await chrome.tabs.get(message.tabId);
  const currentScope = scopeFor(tab.id, tab.url);
  let record = await load(tab.id);
  if (message.type === "CONNECT") {
    if (!record || record.scope !== currentScope)
      record = {
        scope: currentScope,
        session: createSession(currentScope),
        paused: false,
        pending: false,
        autoVeil: true,
      };
    await chrome.storage.session.set({ [key]: record });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
    await chrome.tabs.sendMessage(tab.id, {
      type: "VEILX_CONFIG",
      enabled: !record.paused,
      autoVeil: record.autoVeil !== false,
    });
    return record;
  }
  if (!record || record.scope !== currentScope)
    throw new Error(
      "The site or private session changed. Reconnect and review your draft.",
    );
  if (message.type === "LOAD") return record;
  if (message.type === "RESET") {
    if (
      !validSession(message.session, currentScope) ||
      message.session.entries.length
    )
      throw new Error("Invalid reset session.");
    record.session = message.session;
    record.pending = false;
    record.completedInitialReply = false;
    await chrome.storage.session.set({ [key]: record });
    await chrome.tabs
      .sendMessage(tab.id, { type: "VEILX_CANCEL" })
      .catch(() => {});
    return { cleared: true };
  }
  if (message.type === "SAVE") {
    const next = message.session;
    if (
      !validSession(next, currentScope) ||
      next.id !== record.session.id ||
      !record.session.entries.every((old) =>
        next.entries.some(
          (entry) =>
            entry.placeholder === old.placeholder &&
            entry.original === old.original &&
            entry.type === old.type,
        ),
      )
    )
      throw new Error(
        "Invalid or stale local session. Reconnect before sending.",
      );
    record.session = message.session;
    await chrome.storage.session.set({ [key]: record });
    return { saved: true };
  }
  if (message.type === "AUTO_VEIL") {
    record.autoVeil = Boolean(message.enabled);
    await chrome.storage.session.set({ [key]: record });
    await chrome.tabs.sendMessage(tab.id, {
      type: "VEILX_CONFIG",
      enabled: !record.paused,
      autoVeil: record.autoVeil,
    });
    return { enabled: record.autoVeil };
  }
  if (message.type === "MASK_CURRENT") {
    const result = await chrome.tabs.sendMessage(tab.id, {
      type: "VEILX_MASK_CURRENT",
    });
    if (!result?.ok)
      throw new Error(result?.error || "No supported prose draft is focused.");
    return result;
  }
  if (message.type === "PAUSE") {
    record.paused = Boolean(message.paused);
    await chrome.storage.session.set({ [key]: record });
    await chrome.tabs.sendMessage(tab.id, {
      type: "VEILX_CONFIG",
      enabled: !record.paused,
      autoVeil: record.autoVeil !== false,
    });
    return { paused: record.paused };
  }
  if (message.type === "SEND") {
    if (
      record.pending ||
      message.sessionId !== record.session.id ||
      typeof message.text !== "string" ||
      message.text.length > 20000
    )
      throw new Error(
        "A reply is pending or this preview is stale. Review again.",
      );
    if (
      record.session.entries.some(
        (e) => e.original && message.text.includes(e.original),
      )
    )
      throw new Error(
        "The outbound text still contains a mapped original. Mask and review again.",
      );
    record.pending = true;
    await chrome.storage.session.set({ [key]: record });
    try {
      const reply = await chrome.tabs.sendMessage(tab.id, {
        type: "VEILX_SEND",
        text: message.text,
      });
      if (!reply?.ok)
        throw new Error(reply?.error || "The editor is unavailable.");
      return { started: true };
    } catch (error) {
      const latest = await load(tab.id);
      if (latest) {
        latest.pending = false;
        await chrome.storage.session.set({ [key]: latest });
      }
      throw error;
    }
  }
  if (message.type === "READ_REPLY" || message.type === "CANCEL") {
    if (message.sessionId !== record.session.id)
      throw new Error("The reply belongs to a different session.");
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: message.type === "CANCEL" ? "VEILX_CANCEL" : "VEILX_READ",
    });
    if (
      message.type === "CANCEL" ||
      response?.state === "complete" ||
      response?.state === "error"
    ) {
      record.pending = false;
      record.completedInitialReply = response?.state === "complete";
      await chrome.storage.session.set({ [key]: record });
    }
    return { ...response, session: record.session };
  }
  throw new Error("Unknown extension action.");
}

async function siteAction(message, sender) {
  const tab = await chrome.tabs.get(sender.tab.id);
  const record = await load(tab.id);
  if (!record || record.scope !== scopeFor(tab.id, tab.url))
    throw new Error("Reconnect VeilX on this conversation first.");
  if (message.type === "VEILX_INLINE_SENT") {
    if (!record.pending) {
      record.pending = true;
      record.session.lastUsed = Date.now();
      await chrome.storage.session.set({ [keyFor(tab.id)]: record });
      chrome.runtime
        .sendMessage({
          type: "INLINE_STARTED",
          tabId: tab.id,
          session: record.session,
        })
        .catch(() => {});
    }
    return { started: true };
  }
  if (
    typeof message.text !== "string" ||
    message.text.length > 20000 ||
    !Array.isArray(message.preserveTokens) ||
    message.preserveTokens.length > 2000 ||
    message.preserveTokens.some(
      (token) => typeof token !== "string" || token.length > 50,
    )
  )
    throw new Error("Unsupported editor text.");
  const snapshot = maskText(message.text, record.session, {
    preserveTokens: message.preserveTokens,
  });
  const originals = new Map(
    record.session.entries.map((entry) => [entry.placeholder, entry.original]),
  );
  const original = message.text.replace(
    /\[(?:PERSON|ADDRESS|EMAIL|PHONE|ID|DOB|CARD|SECRET|SESSION_TOKEN)_\d+\]/g,
    (token) =>
      message.preserveTokens.includes(token)
        ? (originals.get(token) ?? token)
        : token,
  );
  await chrome.storage.session.set({ [keyFor(tab.id)]: record });
  chrome.runtime
    .sendMessage({
      type: "SITE_MASKED",
      tabId: tab.id,
      session: record.session,
      original,
      snapshot,
    })
    .catch(() => {});
  return { maskedText: snapshot.maskedText, findings: snapshot.findings };
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (
    message?.type === "VEILX_OPEN" &&
    sender.id === chrome.runtime.id &&
    sender.tab &&
    supportedUrl(sender.url)
  ) {
    chrome.sidePanel.open({ tabId: sender.tab.id }).then(
      () => respond({ ok: true }),
      () => respond({ ok: false }),
    );
    return true;
  }
  if (
    ["VEILX_MASK_EDITOR", "VEILX_INLINE_SENT"].includes(message?.type) &&
    sender.id === chrome.runtime.id &&
    sender.tab &&
    supportedUrl(sender.url)
  ) {
    serial(() => siteAction(message, sender)).then(
      (value) => respond({ ok: true, value }),
      (error) => respond({ ok: false, error: error.message }),
    );
    return true;
  }
  if (!trustedPanel(sender)) return false;
  serial(() => handle(message, sender)).then(
    (value) => respond({ ok: true, value }),
    (error) => respond({ ok: false, error: error.message }),
  );
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  serial(() => chrome.storage.session.remove(keyFor(tabId)));
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.url)
    serial(async () => {
      const record = await load(tabId);
      if (!record) return;
      let transition = transitionScope(record, tabId, change.url);
      if (transition === "bind" && !record.pending) {
        const sameReply = await chrome.tabs
          .sendMessage(tabId, { type: "VEILX_SAME_REPLY" })
          .catch(() => null);
        if (!sameReply?.same) transition = "clear";
      }
      if (transition === "clear") {
        await chrome.storage.session.remove(keyFor(tabId));
        await chrome.tabs
          .sendMessage(tabId, { type: "VEILX_CONFIG", enabled: false })
          .catch(() => {});
        await chrome.tabs
          .sendMessage(tabId, { type: "VEILX_CANCEL" })
          .catch(() => {});
      }
      if (transition === "bind") {
        record.scope = scopeFor(tabId, change.url);
        record.session.scope = record.scope;
        record.completedInitialReply = false;
        await chrome.storage.session.set({ [keyFor(tabId)]: record });
      }
    });
  if (change.status === "complete")
    serial(async () => {
      const record = await load(tabId);
      if (!record) return;
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["content.js"],
        });
        await chrome.tabs.sendMessage(tabId, {
          type: "VEILX_CONFIG",
          enabled: !record.paused,
          autoVeil: record.autoVeil !== false,
        });
      } catch {
        /* Access may have been revoked by the user. */
      }
    });
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "veilx-expiry")
    serial(async () => {
      const all = await chrome.storage.session.get(null);
      for (const key of Object.keys(all))
        if (/^veilx:\d+$/.test(key)) await load(Number(key.slice(6)));
    });
});

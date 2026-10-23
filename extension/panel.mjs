import { createWorkspace } from "../ui/workspace.mjs";
import { scopeFor, supportedUrl } from "../shared/scope.mjs";

let tabId = null,
  cancelled = false,
  connected = false;
const connection = document.getElementById("connection-status");
async function message(type, extra = {}) {
  const response = await chrome.runtime.sendMessage({ type, tabId, ...extra });
  if (!response?.ok)
    throw new Error(
      response?.error ||
        "Extension connection unavailable. Reconnect the site.",
    );
  return response.value;
}
const workspace = createWorkspace({
  scope: "unconnected",
  onSessionChange: async (session) => {
    if (connected) await message("SAVE", { session });
  },
  onReset: async (nextSession) => {
    cancelled = true;
    if (connected) await message("RESET", { session: nextSession });
  },
  onSend: async (text, sessionId) => {
    if (!connected) throw new Error("Connect the current site first.");
    await message("SAVE", { session: workspace.getSession() });
    cancelled = false;
    await message("SEND", { text, sessionId });
    return collectReply(sessionId);
  },
});

let collecting = null;
async function collectReply(sessionId) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline && !cancelled) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    if (cancelled) break;
    const reply = await message("READ_REPLY", { sessionId });
    if (workspace.getSession().id !== sessionId)
      throw new Error("The private session changed.");
    if (reply.session) workspace.setSession(reply.session);
    if (reply.state === "complete") return reply.text;
    if (reply.state === "error")
      throw new Error(reply.error || "Reply interrupted.");
  }
  await message("CANCEL", { sessionId }).catch(() => {});
  throw new Error(
    cancelled ? "Reply collection cancelled." : "Reply collection timed out.",
  );
}
async function collectInline(session) {
  if (collecting === session.id) return;
  collecting = session.id;
  cancelled = false;
  workspace.setSession(session);
  workspace.notice(
    "Collecting the completed site reply. Originals will be restored only in this panel.",
  );
  try {
    workspace.acceptReply(await collectReply(session.id));
  } catch (error) {
    workspace.notice(
      `${error.message} Paste a completed masked reply to restore manually.`,
      "error",
    );
  } finally {
    collecting = null;
  }
}

async function targetTab() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs
    .filter((tab) => supportedUrl(tab.url))
    .sort(
      (a, b) =>
        Number(b.active) - Number(a.active) ||
        (b.lastAccessed || 0) - (a.lastAccessed || 0),
    )[0];
}

document.getElementById("connect-site").addEventListener("click", async () => {
  try {
    // Request the optional ChatGPT grant inside the direct user gesture.
    const active = (
      await chrome.tabs.query({ active: true, currentWindow: true })
    )[0];
    if (!active?.url || active.url.startsWith("https://chatgpt.com/")) {
      const granted = await chrome.permissions.request({
        origins: ["https://chatgpt.com/*"],
      });
      if (!granted)
        throw new Error(
          "ChatGPT access was not granted. Offline masking still works.",
        );
    }
    const tab = await targetTab();
    if (!tab)
      throw new Error(
        "Open ChatGPT or http://127.0.0.1:8000 in this window, then reconnect.",
      );
    if (
      document.getElementById("private-draft").value &&
      !confirm(
        "Connecting starts a tab-bound workspace. Clear this draft and its current map?",
      )
    )
      return;
    cancelled = true;
    connected = false;
    tabId = tab.id;
    const record = await message("CONNECT");
    workspace.reset(scopeFor(tab.id, tab.url));
    workspace.setSession(record.session);
    connected = true;
    document.getElementById("pause-hints").checked = record.paused;
    document.getElementById("auto-site").checked = record.autoVeil !== false;
    connection.textContent = `${new URL(tab.url).hostname} connected. Only reviewed placeholders are sent. Maps expire after 30 minutes of inactivity.`;
    workspace.notice(
      "Site connected. Detected details in the site draft are now veiled locally; review before sending.",
      "success",
    );
    await message("MASK_CURRENT");
  } catch (error) {
    connected = false;
    connection.textContent = error.message;
    workspace.notice(error.message, "error");
  }
});
document
  .getElementById("auto-site")
  .addEventListener("change", async (event) => {
    try {
      if (!connected) throw new Error("Connect the site first.");
      await message("AUTO_VEIL", { enabled: event.target.checked });
      workspace.notice(
        event.target.checked
          ? "Site editor veiling enabled. Websites may observe typing before replacement."
          : "Site editor veiling paused. The private composer still works.",
      );
    } catch (error) {
      event.target.checked = false;
      workspace.notice(error.message, "error");
    }
  });
document.getElementById("veil-current").addEventListener("click", async () => {
  try {
    await message("MASK_CURRENT");
  } catch (error) {
    workspace.notice(error.message, "error");
  }
});
chrome.runtime.onMessage.addListener((event, sender) => {
  if (
    sender.id !== chrome.runtime.id ||
    sender.tab ||
    !connected ||
    event.tabId !== tabId
  )
    return;
  if (event.type === "SITE_MASKED")
    workspace.importSiteDraft(event.original, event.session, event.snapshot);
  if (event.type === "INLINE_STARTED") collectInline(event.session);
});
document
  .getElementById("pause-hints")
  .addEventListener("change", async (event) => {
    try {
      if (!connected)
        throw new Error("Connect a site before changing its hints.");
      await message("PAUSE", { paused: event.target.checked });
      workspace.notice(
        event.target.checked
          ? "Inline hints paused. Local masking in this panel still works."
          : "Inline hints enabled on the connected site.",
      );
    } catch (error) {
      event.target.checked = false;
      workspace.notice(error.message, "error");
    }
  });
document.getElementById("cancel-reply").addEventListener("click", () => {
  cancelled = true;
});
chrome.tabs.onUpdated.addListener((id, change) => {
  if (id !== tabId || !change.url || !connected) return;
  setTimeout(async () => {
    try {
      const record = await message("LOAD");
      if (record.session.id !== workspace.getSession().id)
        throw new Error("Session changed.");
      workspace.setSession(record.session);
    } catch {
      cancelled = true;
      connected = false;
      workspace.reset("unconnected");
      connection.textContent =
        "The conversation changed. The old map was cleared; reconnect to start a new private session.";
    }
  }, 250);
});
chrome.tabs.onRemoved.addListener((id) => {
  if (id === tabId) {
    connected = false;
    cancelled = true;
    workspace.reset("unconnected");
    connection.textContent =
      "The connected tab closed. Its private map was cleared.";
  }
});

// Reopening the panel recovers an existing RAM-only map, but never a saved draft.
targetTab().then(async (tab) => {
  if (!tab) return;
  tabId = tab.id;
  try {
    const record = await message("LOAD");
    workspace.setSession(record.session);
    connected = true;
    document.getElementById("pause-hints").checked = record.paused;
    document.getElementById("auto-site").checked = record.autoVeil !== false;
    if (record.pending) collectInline(record.session);
    else await message("MASK_CURRENT");
    connection.textContent = `${new URL(tab.url).hostname} reconnected to this session. Draft text is not saved.`;
  } catch {
    /* The first connection always needs the user's Connect action. */
  }
});

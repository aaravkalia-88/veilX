import {
  createSession,
  detect,
  maskText,
  restoreText,
  clearSession,
  LABELS,
  TYPES,
} from "../shared/privacy.mjs";

export const SAMPLE =
  "Hi, I'm Maya Sharma. Email me at maya@example.com or call +91 98765 43210. I live at 18 Example Road, Delhi.\n\nWrite a friendly introduction using these details.";

export function createWorkspace({
  scope = "web-workspace",
  onSessionChange = () => {},
  onReset = () => {},
  onSend,
} = {}) {
  const $ = (id) => document.getElementById(id);
  const source = $("private-draft");
  let session = createSession(scope);
  let manual = [],
    ignored = [],
    findings = [],
    result = null,
    resultSource = "",
    composing = false,
    timer;
  let sending = false;
  const notice = (message, tone = "") => {
    $("workspace-status").textContent = message;
    $("workspace-status").dataset.tone = tone;
  };
  const persist = () =>
    Promise.resolve(onSessionChange(session)).catch(() =>
      notice(
        "The local session could not be saved. Keep this panel open or start a new session.",
        "error",
      ),
    );
  const summary = () => ({
    counts_by_type:
      result?.counts ??
      Object.fromEntries(Object.keys(TYPES).map((type) => [type, 0])),
    unresolved_count: result ? 0 : findings.length,
  });

  function invalidate() {
    result = null;
    $("protected-text").textContent = "Your protected text appears here.";
    $("protected-text").classList.add("empty-output");
    $("protection-count").textContent = "Nothing masked yet";
    $("copy-protected").disabled =
      $("undo-masking").disabled =
      $("send-protected").disabled =
        true;
  }

  function renderFindings() {
    const list = $("findings-list");
    list.replaceChildren();
    $("review-findings").textContent =
      `Review ${findings.length} finding${findings.length === 1 ? "" : "s"}`;
    if (!findings.length) {
      const message = document.createElement("p");
      message.className = "boundary-note";
      message.textContent =
        "No configured patterns found. Detection can miss private information; mark any missed text manually.";
      list.append(message);
    }
    for (const finding of findings) {
      const row = document.createElement("article");
      row.className = "finding-row";
      const title = document.createElement("strong");
      title.textContent = LABELS[finding.type];
      const position = document.createElement("small");
      position.textContent = `characters ${finding.start + 1}–${finding.end}`;
      const reason = document.createElement("p");
      reason.textContent = finding.reason;
      const original = document.createElement("p");
      original.className = "original-value";
      original.hidden = true;
      const actions = document.createElement("div");
      actions.className = "finding-actions";
      const reveal = document.createElement("button");
      reveal.type = "button";
      reveal.className = "text-button";
      reveal.textContent = "Reveal locally";
      reveal.addEventListener("click", () => {
        original.hidden = !original.hidden;
        original.textContent = original.hidden
          ? ""
          : source.value.slice(finding.start, finding.end);
        reveal.textContent = original.hidden ? "Reveal locally" : "Conceal";
      });
      actions.append(reveal);
      if (!["secret", "session_token"].includes(finding.type)) {
        const ignore = document.createElement("button");
        ignore.type = "button";
        ignore.className = "text-button";
        ignore.textContent = "Ignore once";
        ignore.addEventListener("click", () => {
          ignored.push(finding.id);
          invalidate();
          scan();
          notice(
            "Ignored for this draft. Ignored text remains visible in the preview; automated protected send is disabled until you edit or reset.",
            "error",
          );
        });
        actions.append(ignore);
      }
      row.append(title, position, reason, original, actions);
      list.append(row);
    }
  }

  function scan() {
    if (composing) return;
    try {
      findings = detect(source.value, manual).filter(
        (f) => !ignored.includes(f.id),
      );
      $("character-count").textContent =
        `${source.value.length.toLocaleString()} / 20,000`;
      renderFindings();
    } catch (error) {
      findings = [];
      invalidate();
      notice(error.message, "error");
    }
  }

  source.addEventListener("compositionstart", () => {
    composing = true;
    invalidate();
  });
  source.addEventListener("compositionend", () => {
    composing = false;
    manual = [];
    ignored = [];
    if ($("auto-veil").checked && source.value.trim()) mask();
    else scan();
  });
  source.addEventListener("input", () => {
    manual = [];
    ignored = [];
    invalidate();
    clearTimeout(timer);
    if (!composing)
      timer = setTimeout(() => {
        if ($("auto-veil").checked && source.value.trim()) mask();
        else {
          scan();
          notice(
            "Local suggestions updated. Review the protected preview before sharing.",
          );
        }
      }, 160);
  });

  function showMask() {
    $("protected-text").textContent = result.maskedText;
    $("protected-text").classList.remove("empty-output");
    const total = Object.values(result.counts).reduce(
      (sum, count) => sum + count,
      0,
    );
    $("protection-count").textContent =
      `${total} item${total === 1 ? "" : "s"} masked · originals stay local`;
    $("copy-protected").disabled = $("undo-masking").disabled = false;
    $("send-protected").disabled = !onSend || ignored.length > 0 || sending;
    notice(
      ignored.length
        ? "Preview ready. Ignored text remains unmasked; automated protected send is disabled."
        : "Preview ready. Check for missed information before sharing.",
      ignored.length ? "error" : "success",
    );
  }

  function mask() {
    if (composing)
      return notice("Finish composing this text before masking.", "error");
    if (!source.value.trim())
      return notice("Write a message or load the fictional sample first.");
    clearTimeout(timer);
    try {
      scan();
      result = maskText(source.value, session, { manual, ignored });
      resultSource = source.value;
      showMask();
      persist();
    } catch (error) {
      invalidate();
      notice(error.message, "error");
      persist();
    }
  }
  $("mask-all").addEventListener("click", mask);
  $("auto-veil").addEventListener("change", () => {
    if ($("auto-veil").checked && source.value.trim()) mask();
  });

  $("mark-selection").addEventListener("click", () => {
    const start = source.selectionStart,
      end = source.selectionEnd;
    if (start === end)
      return notice(
        "Select the private text in your draft first, then choose its category.",
        "error",
      );
    manual.push({ start, end, type: $("manual-type").value });
    invalidate();
    scan();
    notice("Selection marked locally. Choose Mask all to update the preview.");
  });
  $("load-sample").addEventListener("click", () => {
    if (
      source.value &&
      !confirm(
        "Replace this draft with a clearly labeled fictional example? Your existing session map stays local.",
      )
    )
      return;
    source.value = SAMPLE;
    manual = [];
    ignored = [];
    invalidate();
    scan();
    source.focus();
    notice(
      "Fictional example loaded. These are sample details, not live user data.",
    );
  });
  $("copy-protected").addEventListener("click", async () => {
    if (!result || source.value !== resultSource) return;
    try {
      await navigator.clipboard.writeText(result.maskedText);
      notice("Reviewed text copied. Paste it into the destination you choose.");
    } catch {
      notice(
        "Clipboard unavailable. Select and copy the protected preview manually.",
        "error",
      );
    }
  });
  $("undo-masking").addEventListener("click", () => {
    invalidate();
    source.focus();
    notice("Masking preview undone. Your original draft is unchanged.");
  });

  function restore() {
    try {
      $("restored-text").textContent = restoreText(
        $("masked-reply").value,
        session,
      );
      $("restored-text").classList.remove("empty-output");
      persist();
      notice(
        "Restored only here. Credentials and unknown tokens remain masked.",
        "success",
      );
    } catch (error) {
      $("restored-text").textContent =
        "Map unavailable. Original details cannot be restored.";
      notice(error.message, "error");
      persist();
    }
  }
  $("restore-locally").addEventListener("click", restore);
  $("send-protected").addEventListener("click", async () => {
    if (!result || source.value !== resultSource || ignored.length || sending)
      return;
    sending = true;
    $("send-protected").disabled = true;
    $("cancel-reply").hidden = false;
    notice(
      "Sending only the reviewed masked text. Waiting for a completed reply…",
    );
    try {
      const reply = await onSend(result.maskedText, session.id);
      $("masked-reply").value = reply;
      restore();
    } catch (error) {
      notice(
        `${error.message} You can paste a completed masked reply below.`,
        "error",
      );
    } finally {
      sending = false;
      $("cancel-reply").hidden = true;
      $("send-protected").disabled = !result || ignored.length > 0;
    }
  });

  function reset(nextScope = session.scope) {
    clearSession(session);
    session = createSession(nextScope);
    manual = [];
    ignored = [];
    findings = [];
    source.value = "";
    $("masked-reply").value = "";
    $("restored-text").textContent =
      "The readable answer stays on your device.";
    $("restored-text").classList.add("empty-output");
    invalidate();
    scan();
    Promise.resolve(onReset(session))
      .then(persist)
      .catch(() =>
        notice(
          "Session cleared in this panel. Reconnect to clear the stored session.",
          "error",
        ),
      );
    notice("Session cleared. Previous placeholders no longer restore.");
  }
  $("clear-session").addEventListener("click", () => reset());

  if (!("commandForElement" in HTMLButtonElement.prototype)) {
    document
      .querySelectorAll('[commandfor="findings-popover"]')
      .forEach((button) =>
        button.addEventListener("click", () => {
          const popover = $("findings-popover");
          if ("popover" in HTMLElement.prototype) {
            if (button.getAttribute("command") === "hide-popover")
              popover.hidePopover();
            else popover.togglePopover();
          } else {
            const open = popover.classList.toggle("fallback-open");
            button.setAttribute("aria-expanded", String(open));
          }
        }),
      );
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape")
      $("findings-popover").classList.remove("fallback-open");
  });
  scan();
  return {
    getSession: () => session,
    getSummary: summary,
    notice,
    reset,
    setSession(next) {
      restoreText("", next);
      if (session.id !== next.id) invalidate();
      session = next;
    },
    importSiteDraft(original, nextSession, snapshot) {
      clearTimeout(timer);
      session = nextSession;
      source.value = original;
      manual = [];
      ignored = [];
      scan();
      result = snapshot;
      resultSource = original;
      showMask();
      notice(
        "Site draft veiled. The website may have observed earlier typing; originals are now shown only here.",
      );
    },
    acceptReply(reply) {
      $("masked-reply").value = reply;
      restore();
    },
  };
}

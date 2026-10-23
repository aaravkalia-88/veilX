import { detect, eligibleField } from "../shared/privacy.mjs";

if (!globalThis.__veilxInstalled) {
  globalThis.__veilxInstalled = true;
  let enabled = false,
    autoVeil = false,
    rewriting = false,
    sendingFromPanel = false,
    active = null,
    scanTimer,
    veilTimer,
    pending = null,
    replyObserver,
    replyTimer;
  const editorStates = new WeakMap();
  const placeholderInstruction =
    "Keep every bracketed VeilX placeholder exactly unchanged in your answer. Do not guess the original values.";
  const host = document.createElement("div");
  host.id = "veilx-hints";
  host.hidden = true;
  const root = host.attachShadow({ mode: "closed" });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(
    `:host{position:fixed;z-index:2147483646;left:var(--x,0px);top:var(--y,0px);font-family:system-ui,sans-serif;color:#234b37}button{cursor:pointer;font:inherit}button:focus-visible{outline:2px solid #087f6d;outline-offset:3px}.badge{border:1px solid #a9cfb9;border-radius:9px;background:#f0f8ee;color:#087f6d;font-size:11px;font-weight:600;height:29px;padding:0 10px;box-shadow:0 3px 12px #0004}.hint{position:fixed;inset:auto;left:var(--px,10px);top:var(--py,10px);width:min(290px,calc(100vw - 24px));box-sizing:border-box;background:#ffffff;color:#234b37;border:1px solid #b7d4c0;border-radius:10px;padding:17px;margin:0;box-shadow:0 14px 50px #0005}.hint h2{font-size:14px;margin:0 0 9px}.hint p{font-size:12px;line-height:1.6;margin:8px 0;color:#53735c}.open{margin-top:9px;padding:9px 12px;border:0;border-radius:5px;background:#087f6d;color:#ffffff;font-size:12px;font-weight:600}`,
  );
  root.adoptedStyleSheets = [sheet];
  const badge = document.createElement("button");
  badge.type = "button";
  badge.className = "badge";
  badge.textContent = "V";
  badge.setAttribute("aria-label", "VeilX local privacy hints");
  const popover = document.createElement("div");
  popover.id = "veilx-suggestions";
  popover.className = "hint";
  popover.setAttribute("popover", "auto");
  badge.setAttribute("popovertarget", popover.id);
  const title = document.createElement("h2");
  title.textContent = "A little privacy check";
  const count = document.createElement("p");
  const warning = document.createElement("p");
  warning.textContent =
    "This website can read text typed here. Compose in the VeilX side panel to keep original details out of its editor.";
  const replace = document.createElement("button");
  replace.type = "button";
  replace.className = "open";
  replace.textContent = "Replace with placeholders";
  replace.addEventListener("click", () =>
    maskEditor(true).catch((error) => {
      count.textContent = error.message;
    }),
  );
  const open = document.createElement("button");
  open.type = "button";
  open.className = "open";
  open.textContent = "Open private composer";
  open.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "VEILX_OPEN" }).catch(() => {});
    popover.hidePopover();
  });
  popover.append(title, count, warning, replace, open);
  root.append(badge, popover);
  document.documentElement.append(host);

  function eligible(element) {
    if (!element || element.closest("[data-veilx-private]")) return false;
    const form = element.closest("form");
    return eligibleField({
      tag: element.tagName,
      type: element.type,
      editable: element.isContentEditable,
      autocomplete: element.autocomplete || "",
      disabled: element.disabled,
      readOnly: element.readOnly,
      label: [
        element.getAttribute("aria-label"),
        element.getAttribute("name"),
        element.id,
        element.getAttribute("placeholder"),
        ...Array.from(element.labels || [], (label) => label.textContent),
      ]
        .filter(Boolean)
        .join(" "),
      sensitiveContainer: Boolean(
        form?.querySelector(
          'input[type="password"],input[autocomplete="cc-number"],input[autocomplete="one-time-code"]',
        ),
      ),
    });
  }
  function position() {
    if (!active || host.hidden) return;
    const rect = active.getBoundingClientRect();
    if (
      rect.width < 60 ||
      rect.height < 25 ||
      rect.bottom < 0 ||
      rect.top > innerHeight
    ) {
      host.hidden = true;
      return;
    }
    const x = Math.max(7, Math.min(innerWidth - 65, rect.right - 62));
    const y = Math.max(7, Math.min(innerHeight - 36, rect.bottom + 4));
    const style = sheet.cssRules[0].style;
    style.setProperty("--x", `${x}px`);
    style.setProperty("--y", `${y}px`);
    style.setProperty(
      "--px",
      `${Math.max(10, Math.min(innerWidth - 302, x - 230))}px`,
    );
    style.setProperty(
      "--py",
      `${Math.max(10, Math.min(innerHeight - 255, y + 35))}px`,
    );
  }
  function scan() {
    if (!enabled || !eligible(active)) {
      host.hidden = true;
      return;
    }
    try {
      const text = active.value ?? active.innerText;
      const findings = detect(text);
      badge.textContent = `V · ${findings.length}`;
      badge.setAttribute(
        "aria-label",
        `VeilX: ${findings.length} local privacy finding${findings.length === 1 ? "" : "s"}`,
      );
      count.textContent = findings.length
        ? `${findings.length} possible sensitive item(s) found locally. Review in the private composer before sharing.`
        : "No configured patterns found. This does not guarantee the text is free of private information.";
      if (
        text === editorStates.get(active)?.maskedText &&
        /\[(?:PERSON|ADDRESS|EMAIL|PHONE|ID|DOB|CARD|SECRET|SESSION_TOKEN)_\d+\]/.test(
          text,
        )
      ) {
        badge.textContent = "V · veiled";
        badge.setAttribute(
          "aria-label",
          "VeilX: placeholders active in this draft",
        );
        count.textContent =
          "Placeholders are active. Review before sending; readable replies appear in VeilX only.";
      }
      host.hidden = false;
      position();
    } catch {
      badge.textContent = "V · !";
      count.textContent =
        "This field is too large or unsupported. Use the private composer or a smaller selection.";
      host.hidden = false;
      position();
    }
  }
  document.addEventListener("focusin", (event) => {
    if (event.target === host) return;
    active = event.target.closest?.('textarea,input,[contenteditable="true"]');
    scan();
  });
  document.addEventListener("input", (event) => {
    if (rewriting || event.isComposing || !eligible(event.target)) return;
    active = event.target;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 180);
    clearTimeout(veilTimer);
    if (autoVeil)
      veilTimer = setTimeout(
        () =>
          maskEditor().catch((error) => {
            count.textContent = error.message;
          }),
        260,
      );
  });
  document.addEventListener("compositionend", (event) => {
    if (event.target === active) {
      scan();
      if (autoVeil)
        maskEditor().catch((error) => {
          count.textContent = error.message;
        });
    }
  });
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.composedPath().includes(host) || event.target === active)
        return;
      if (!event.target.closest?.('textarea,input,[contenteditable="true"]'))
        host.hidden = true;
    },
    true,
  );
  addEventListener("scroll", position, { passive: true, capture: true });
  addEventListener("resize", position, { passive: true });

  const composer = () =>
    document.querySelector("#prompt-textarea, #mobile-composer-prompt");
  const fieldText = (editor) => editor.value ?? editor.innerText;
  function replaceText(editor, text, findings = []) {
    rewriting = true;
    try {
      if (["TEXTAREA", "INPUT"].includes(editor.tagName)) {
        const start = editor.selectionStart,
          end = editor.selectionEnd;
        const position = (offset) => {
          let delta = 0;
          for (const finding of findings) {
            if (offset < finding.start) break;
            if (offset <= finding.end)
              return finding.start + delta + finding.placeholder.length;
            delta += finding.placeholder.length - (finding.end - finding.start);
          }
          return offset + delta;
        };
        const prototype =
          editor.tagName === "TEXTAREA"
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, "value").set.call(
          editor,
          text,
        );
        editor.setSelectionRange(position(start), position(end));
        editor.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        editor.focus();
        const range = document.createRange();
        range.selectNodeContents(editor);
        const selection = getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        // Native line breaks preserve the reviewed text; multi-line insertText can add extra paragraphs.
        for (const [index, line] of text
          .replace(/\r\n/g, "\n")
          .split("\n")
          .entries()) {
          if (
            (index && !document.execCommand("insertLineBreak", false)) ||
            (line && !document.execCommand("insertText", false, line))
          )
            throw new Error("Use the private composer for this rich editor.");
        }
        editor.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            inputType: "insertText",
            data: text,
          }),
        );
      }
    } finally {
      rewriting = false;
    }
  }
  async function maskEditor(force = false) {
    const editor = eligible(active) && active.isConnected ? active : composer();
    if (!eligible(editor))
      throw new Error("Focus a supported prose editor first.");
    const text = fieldText(editor);
    if (!text.trim()) return;
    const previous = editorStates.get(editor)?.maskedText || "";
    if (!force && text === previous) return;
    const tokenPattern =
      /\[(?:PERSON|ADDRESS|EMAIL|PHONE|ID|DOB|CARD|SECRET|SESSION_TOKEN)_\d+\]/g;
    const before = previous.match(tokenPattern) || [],
      after = text.match(tokenPattern) || [];
    const preserveTokens = [...new Set(before)].filter(
      (token) =>
        after.filter((item) => item === token).length <=
        before.filter((item) => item === token).length,
    );
    const response = await chrome.runtime.sendMessage({
      type: "VEILX_MASK_EDITOR",
      text,
      preserveTokens,
    });
    if (!response?.ok)
      throw new Error(response?.error || "Local masking was unavailable.");
    if (!editor.isConnected || fieldText(editor) !== text) return;
    replaceText(editor, response.value.maskedText, response.value.findings);
    editorStates.set(editor, { maskedText: response.value.maskedText });
    badge.textContent = "V · veiled";
    count.textContent =
      "Detected details were replaced locally. Review the editor before sending. The completed reply will be readable in the VeilX panel.";
  }

  const assistants = () => [
    ...document.querySelectorAll(
      '[data-message-author-role="assistant"], [data-message-role="assistant"]',
    ),
  ];
  const stopButton = () => {
    const button = document.querySelector(
      'button[data-testid="stop-button"],button[aria-label="Stop generating"],button[aria-label="Stop streaming"]',
    );
    return button && !button.hidden && button.getBoundingClientRect().width > 0
      ? button
      : null;
  };
  function stopObserving() {
    replyObserver?.disconnect();
    clearTimeout(replyTimer);
  }
  function replyError(message) {
    stopObserving();
    pending = { ...pending, state: "error", error: message };
  }
  function inspectReply() {
    if (pending?.state !== "waiting") return;
    if (Date.now() - pending.startedAt > 120000)
      return replyError("Reply timed out.");
    const messages = assistants();
    if (messages.length <= pending.beforeCount) return;
    const latest = messages[pending.beforeCount];
    pending.replyNode = latest;
    const text = (
      latest.querySelector("[data-assistant-markdown], .markdown") || latest
    ).innerText;
    if (!text.trim()) return;
    if (text.length > 20000)
      return replyError(
        "Reply exceeds the local restoration limit. Split it before pasting.",
      );
    if (text !== pending.text) {
      pending.text = text;
      pending.changedAt = Date.now();
    }
    clearTimeout(replyTimer);
    if (
      stopButton() ||
      (latest.hasAttribute("data-message-role") &&
        !latest.hasAttribute("data-message-complete"))
    )
      return;
    if (Date.now() - pending.changedAt >= 1200) {
      pending.state = "complete";
      stopObserving();
    } else replyTimer = setTimeout(inspectReply, 1300);
  }
  document.addEventListener(
    "click",
    (event) => {
      if (
        pending?.state === "waiting" &&
        event.target.closest?.(
          'button[data-testid="stop-button"],button[aria-label="Stop generating"],button[aria-label="Stop streaming"]',
        )
      )
        replyError(
          "Generation was interrupted. Paste a completed reply to restore it safely.",
        );
    },
    true,
  );

  function beginReply() {
    stopObserving();
    pending = {
      state: "waiting",
      beforeCount: assistants().length,
      startedAt: Date.now(),
      changedAt: Date.now(),
      text: "",
    };
    replyObserver = new MutationObserver(inspectReply);
    replyObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "disabled",
        "aria-label",
        "data-testid",
        "data-message-complete",
        "aria-busy",
      ],
    });
  }
  function normalSend(event) {
    if (!autoVeil || sendingFromPanel) return;
    const editor = composer();
    if (!eligible(editor) || !fieldText(editor).trim()) return;
    if (fieldText(editor) !== editorStates.get(editor)?.maskedText) {
      event.preventDefault();
      event.stopImmediatePropagation();
      active = editor;
      maskEditor(true).then(
        () => {
          count.textContent =
            "VeilX updated this draft. Review the placeholders and press Send again.";
        },
        (error) => {
          count.textContent = error.message;
        },
      );
      return;
    }
    if (pending?.state === "waiting") return;
    const outbound = `${placeholderInstruction}\n\n${fieldText(editor)}`;
    replaceText(editor, outbound);
    if (
      fieldText(editor).replace(/\r\n/g, "\n").trimEnd() !== outbound.trimEnd()
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      count.textContent =
        "This editor changed the protected text. Use the private composer or manual restoration.";
      return;
    }
    editorStates.set(editor, { maskedText: outbound });
    beginReply();
    chrome.runtime.sendMessage({ type: "VEILX_INLINE_SENT" }).then(
      (response) => {
        if (!response?.ok)
          replyError("Reconnect VeilX before collecting a reply.");
      },
      () => replyError("Reconnect VeilX before collecting a reply."),
    );
  }
  document.addEventListener(
    "click",
    (event) => {
      if (
        event.target.closest?.(
          'button[data-testid="send-button"],button[type="submit"][aria-label="Send message"]',
        )
      )
        normalSend(event);
    },
    true,
  );
  document.addEventListener(
    "submit",
    (event) => {
      if (event.target.contains(composer())) normalSend(event);
    },
    true,
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.isComposing &&
        event.target === composer()
      )
        normalSend(event);
    },
    true,
  );

  async function sendMasked(text) {
    const fixture =
      ["127.0.0.1", "localhost"].includes(location.hostname) &&
      document.documentElement.dataset.veilxFixture === "chat";
    if (!fixture && location.hostname !== "chatgpt.com")
      throw new Error(
        "Automatic sending is supported only on ChatGPT and the labeled local fixture.",
      );
    const editor = document.querySelector(
      "#prompt-textarea, #mobile-composer-prompt",
    );
    if (!eligible(editor))
      throw new Error("The supported ChatGPT composer was not found.");
    if (
      fieldText(editor).trim() &&
      (fieldText(editor) !== text ||
        editorStates.get(editor)?.maskedText !== text)
    )
      throw new Error(
        "The website already has a draft. Save or clear it before sending from VeilX.",
      );
    if (stopButton())
      throw new Error("Wait for the current generation to finish.");
    const outbound = `${placeholderInstruction}\n\n${text}`;
    editor.focus();
    replaceText(editor, outbound);
    await new Promise((resolve) => setTimeout(resolve, 180));
    if (
      (editor.value ?? editor.innerText).replace(/\r\n/g, "\n").trimEnd() !==
      outbound.trimEnd()
    )
      throw new Error(
        "Editor verification failed. Nothing was automatically submitted.",
      );
    editorStates.set(editor, { maskedText: outbound });
    clearTimeout(veilTimer);
    const send = [
      ...document.querySelectorAll(
        'button[data-testid="send-button"],button[type="submit"][aria-label="Send message"]',
      ),
    ].find(
      (button) => button.getBoundingClientRect().width > 0 && !button.disabled,
    );
    if (!send || send.disabled || send.getBoundingClientRect().width === 0)
      throw new Error(
        "The send control is unavailable. The masked text is inserted; send it manually if appropriate.",
      );
    beginReply();
    sendingFromPanel = true;
    try {
      send.click();
    } finally {
      sendingFromPanel = false;
    }
    inspectReply();
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return false;
    if (message?.type === "VEILX_CONFIG") {
      enabled = Boolean(message.enabled);
      autoVeil = Boolean(message.autoVeil);
      if (autoVeil) maskEditor().catch(() => {});
      if (!enabled) {
        host.hidden = true;
        popover.hidePopover();
      } else scan();
      respond({ ok: true });
      return false;
    }
    if (message?.type === "VEILX_SAME_REPLY") {
      respond({
        same: Boolean(
          pending?.state === "complete" && pending.replyNode?.isConnected,
        ),
      });
      return false;
    }
    if (message?.type === "VEILX_MASK_CURRENT") {
      maskEditor(true).catch((error) => {
        count.textContent = error.message;
      });
      respond({ ok: true });
      return false;
    }
    if (message?.type === "VEILX_SEND") {
      if (typeof message.text !== "string" || message.text.length > 20000) {
        respond({ ok: false, error: "Invalid masked message." });
        return false;
      }
      sendMasked(message.text).then(
        () => respond({ ok: true }),
        (error) => respond({ ok: false, error: error.message }),
      );
      return true;
    }
    if (message?.type === "VEILX_READ") {
      inspectReply();
      respond(
        pending
          ? {
              state: pending.state,
              text: pending.state === "complete" ? pending.text : "",
              error: pending.error,
            }
          : { state: "error", error: "No pending response in this page." },
      );
      return false;
    }
    if (message?.type === "VEILX_CANCEL") {
      replyError("Reply collection cancelled.");
      respond({ state: "error", error: "Reply collection cancelled." });
      return false;
    }
    return false;
  });
}

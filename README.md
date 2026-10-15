# VeilX — graphical product walkthrough

**Open [index.html](index.html) in a browser.** It is one self-contained file and works offline, including its interactions. No installation, API key, build step, external font, analytics, or server is required.

This is the first reviewable artifact requested from the product brief, before the full product specification and application implementation. The brief calls the product Veil; this concept uses **VeilX** to match the requested name and repository.

## What to try

1. **The experience:** advance the fictional draft through detection, placeholder replacement, and local reply restoration. Switch to the session-cookie example; credentials stay hidden even in the restored reply.
2. **The intelligence:** replay the illustrated TinyFish agent journey. Select training-policy findings to see High/Medium/Low risk and Strict/Standard mode change. Unknown findings fail safe to High/Strict.
3. **The session shield:** inspect fictional active-cookie metadata, simulate a known tracker request, and pause Cookie Guard to compare behavior. First-party sign-in traffic remains allowed in this model.
4. **The architecture:** review the local/cloud boundary, integration contract, security constraints, and build order.

Everything is an **illustration**. The file does not detect arbitrary text, contact a chatbot, call TinyFish, read real cookies, or enforce browser network rules. All values are fixed fictional fixtures. Reserved `.invalid` domains cannot be mistaken for a working provider. Policy results make no claims about actual ChatGPT, Gemini, or Claude practices.

## TinyFish's role in the planned product

The extension sends only an approved chatbot domain to a proposed `POST /api/audit` FastAPI route. The backend uses TinyFish to navigate public privacy policies, terms, and data-control instructions; it validates evidence with Pydantic, relays safe progress, and caches results in SQLite for seven days. TinyFish does the live multi-page research. VeilX computes the rating from the findings. Keys stay in backend environment variables.

The official [TinyFish cookbook](https://github.com/tinyfish-io/tinyfish-cookbook) verifies `POST https://agent.tinyfish.ai/v1/automation/run-sse`, the `X-API-Key` header, `url` and `goal` request fields, and streamed progress. The HTML includes the intended agent goal. Event parsing and preview integration must be checked against [official documentation](https://docs.tinyfish.ai/) when the backend is implemented; this artifact does not invent provider event formats.

The intended policy result fields are `domain`, `policy_url`, `trains_on_chats`, `retention`, `human_review`, `opt_out_steps`, `last_updated`, and `evidence` (a list of `{claim, section}`). Training values: `yes_by_default`, `opt_out_available`, `no`, `unclear`. Human-review values: `yes`, `no`, `unclear`. Missing facts stay unknown. Only explicit `no` gives Low training risk; unknown or failed audits give High/Strict. A Low training rating does not certify all privacy practices.

## Cookie Guard scope and decisions

- Keep real cookies in the browser's native cookie store. The proposed section displays only local domain, expiry, and security flags, with optional site permissions.
- The [Chrome cookies API](https://developer.chrome.com/docs/extensions/reference/api/cookies) returns cookie objects that can contain secrets. Isolate this access in the extension worker; discard values immediately, send only allowlisted metadata to the extension UI, and never log, persist, or upload cookie values.
- Locally block pasted session secrets before prompt submission. Ordinary personal placeholders can be restored; credential placeholders must remain hidden.
- Use a reviewed [declarativeNetRequest](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) rule set for known trackers, with per-site permission and pause controls. It is not a general request-body scanner or a guarantee against all leaks.
- Warn about insecure flags. Do not silently change login cookies or sign users out. Secure, HttpOnly, and SameSite are distinct browser protections; [their meanings are documented by MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).
- A chatbot can observe raw drafts and restored replies in its own DOM. For the strong privacy path, compose and show restored replies in an extension-owned side panel or popup, and insert only redacted text into the provider page. In-page convenience mode must disclose its weaker boundary. Shadow DOM only isolates styling.

These choices extend the original prompt/privacy concept with the requested active-session feature, without claiming universal browser security. A static HTML file cannot implement extension permissions or enforce a cookie boundary.

## Planned stack, not yet implemented

`veil/extension`: Chrome MV3, TypeScript, WXT, React, Tailwind; regex and validators first, libphonenumber-js and Luhn card validation; transformers.js NER later. Local placeholder maps use memory or `chrome.storage.session`, with explicit clear behavior. MutationObserver handles provider streaming replies, with protected restoration in extension UI.

`veil/backend`: Python 3.11+, FastAPI, Uvicorn, httpx, Pydantic, python-dotenv, SQLite. Strict body/domain validation, allowlisted targets and redirects, origin restrictions, authentication, rate limits, bounded timeouts, and no private-content logging are required before hosting.

`veil/web`: Vite + React demo playground. The present single HTML artifact precedes that application. The four full specification files requested in the source brief are deferred until the graphical concept is reviewed, following the user's “HTML first” direction.

## Validation

Run the dependency-free model and artifact checks with Node.js 22 or later:

```sh
node --test tests/walkthrough.test.cjs
```

The HTML uses hash-authorized inline scripts/styles and a Content Security Policy that denies network connections. If editing those blocks, refresh the hashes:

```sh
node scripts/seal-html.cjs
node --test tests/walkthrough.test.cjs
```

Browser verification and TDD evidence are recorded in [docs/verification.md](docs/verification.md). Synthetic samples test the walkthrough model, not production PII detection, cookie enforcement, or live policy accuracy. No application dependencies have been introduced. No license is selected yet; the repository owner should choose one before reuse outside this project.

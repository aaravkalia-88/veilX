> Historical architecture guide, preserved from the documentation-only repository. For implemented status, see [ARC.md](../ARC.md).

# VeilX — complete system graph

**Open [index.html](../index.html): 106 components, 182 labeled connections, 13 architectural groups.** This is the extended architecture diagram requested from the reference image. It documents the proposed application; it does not implement the browser extension or backend.

The graph is embedded in the HTML and works offline. No installation, server, API key, analytics, remote assets or external renderer is needed to view it. The earlier graphical walkthrough is preserved at [walkthrough.html](../walkthrough.html).

## Explore or share

- Drag to pan; scroll or use **+ / −** to zoom. **100%** gives readable labels; **Fit** returns to the current trace.
- Select a component for its responsibility, proposed module, data boundary and incoming/outgoing connections. Follow another connection from the details panel.
- Search for a feature, component or module. Choose a feature trace for prompt redaction, reply restoration, active cookies, TinyFish, supporting pieces or stretch opt-out work.
- Keyboard: Tab to a node, Enter/Space to inspect, arrows to pan, +/− to zoom, Home to fit, Escape to clear selection.
- For PDF or PowerPoint, download the [high-resolution PNG](veilx-system-map.png): 6000 × 8312 pixels, 300 DPI. The [vector SVG](veilx-system-map.svg) stays sharp at any size. The [DOT graph](architecture.dot) is editable in Graphviz-compatible tools.

Every application module path is **proposed**, not a claim that the file exists or the feature has been built.

## What connects to what

| Group | Contents |
| --- | --- |
| Person + extension experience | Protected composer, private answer panel, popup, settings, onboarding, risk/evidence/progress and active-session section |
| Local input + detection | Typing, paste, IME, offsets, regex, phone/card/ID validation, address rules, phase-2 NER, secrets, overlap resolution and review |
| Placeholder types | `[PERSON_1]`, `[ADDRESS_1]`, `[EMAIL_1]`, `[PHONE_1]`, `[CARD_1]`, `[ID_1]`, `[SESSION_1]` |
| Local mapping + send | Conversation numbering, temporary map, replacement, auto-redact, pre-send gate, cleanup and expired-map handling |
| Chatbot boundary | ChatGPT/Gemini/Claude rich-text adapters, outgoing text, provider-owned DOM and AI service |
| Local restoration | MutationObserver, streaming buffer, exact parsing, map lookup, credential suppression and safe local rendering |
| Cookie / session protection | Native cookies, site permission, worker, discarded values, metadata, flag warnings, tracker rules, first-party login and pause/revocation |
| Extension auditor | Domain observation, domain-only request, progress and unknown/offline High/Strict fallback |
| Backend | FastAPI, origin/auth/rate limits, URL policy, cache hit/miss, TinyFish client/goal, Pydantic, scoring, streaming, SQLite, environment key and safe logs |
| TinyFish | Streaming endpoint, public-web agent, real progress, live-preview integration point and structured finding |
| Public sources | Official site, privacy policy, terms, public data-control instructions and source evidence |
| Supporting pieces | Preferences, temporary state, local model assets, demo fixtures, unit/integration/audit/cookie/accessibility tests and recorded demo |
| Stretch | Separately authorized training opt-out automation; execution boundary must be designed first |

## Privacy paths

**Personal information:** raw originals → extension-owned composer → local detection/review → placeholders + temporary map → redacted text to AI → placeholder reply → local map lookup → readable answer in extension-owned UI. The AI does not receive the original mapped values through this protected path. Detection can miss information, so review is still necessary.

Names, addresses, email and mobile can be restored into the private answer. Session credentials are removed/replaced and **never restored**. Original mappings use memory or restricted `chrome.storage.session` with explicit cleanup; no mapping reaches the backend, TinyFish, synced storage or logs.

A provider can observe raw typing and restored values in its own DOM. The protected design keeps both in an extension-origin side panel/popup; in-page underlines are a disclosed convenience mode. Shadow DOM only isolates styles. Normal first-party login still identifies the account to its provider.

**Cookie Guard:** cookies remain in Chrome’s native store. The optional local worker discards returned values and exposes metadata only. Pasted-secret scanning and reviewed browser rules address specific leakage/tracking paths. This is not an encrypted cookie vault, arbitrary request-body inspection, or a guarantee against all exfiltration. Sites choose their authentication flags; VeilX does not silently rewrite them.

**TinyFish:** approved domain → proposed `POST /api/audit` → validated FastAPI request → fresh SQLite cache hit or real TinyFish run → public policy/terms/data-control pages → evidence → Pydantic validation → seven-day cache → risk/evidence/progress and local redaction mode. The audit backend receives no original prompt, map, session value or user browser profile. TinyFish’s key stays on the backend.

The [official TinyFish cookbook](https://github.com/tinyfish-io/tinyfish-cookbook) verifies `POST https://agent.tinyfish.ai/v1/automation/run-sse`, `X-API-Key`, and `url`/`goal`. Event parsing and live-preview handoff must be verified during integration; the graph invents neither provider event schemas nor live results. The VeilX `/api/audit` route is a proposed design decision.

Training risk: `yes_by_default`/`unclear` → High/Strict; `opt_out_available` → Medium/Standard; `no` → Low/Standard. Missing retention/review evidence stays unknown; Low training risk is not a complete privacy certification.

## Edit and rebuild the documentation

View the generated HTML/SVG directly without dependencies. To regenerate from the model, use Node.js 22 or later:

```sh
npm ci --ignore-scripts
npm run build
npm test
```

`@viz-js/viz` is a pinned **build-only** dependency for Graphviz layout; the delivered HTML never loads it. The planned application stack remains WXT/MV3/TypeScript/React/Tailwind, local regex/validators and later transformers.js, Python 3.11+/FastAPI/httpx/Pydantic/SQLite, and a Vite/React demo. None of that application is built here.

| File | Purpose |
| --- | --- |
| `docs/architecture.json` | Editable components, groups, connections, payload boundaries and phases |
| `docs/map-shell.html` | Explorer template and local interaction |
| `scripts/build-map.cjs` | Validate references, lay out graph, generate DOT/SVG/HTML and refresh CSP hashes |
| `scripts/seal-html.cjs` | Authorize exact inline scripts/styles with CSP hashes |
| `index.html` | Generated offline graph explorer |
| `docs/veilx-system-map.svg` | Generated static vector diagram |
| `docs/veilx-system-map.png` | High-resolution image export for PDF/PowerPoint |
| `docs/architecture.dot` | Generated Graphviz source |
| `tests/architecture.test.cjs` | Completeness, privacy, feature paths, exports, search and traces |
| `walkthrough.html` | Preserved earlier concept walkthrough |

[Graph verification](system-map-verification.md) records checks and limits. [Earlier walkthrough verification](verification.md) remains historical. Application specifications and implementation are deferred; the current deliverable is the extended graph. The original [GPLv3 license](../LICENSE) is preserved.

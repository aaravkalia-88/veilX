# VeilX — ARC.md

> **Living architecture record.** Codex: keep this document short and accurate. Update it **as code is written**, after each meaningful implementation or architectural change. Never describe planned functionality as implemented.

## Current state
- **Phase:** Hackathon MVP implementation, 2026-10-23.
- **Implemented:** Shared local NLP/pattern masking and restoration engine; Python aggregate-only validation/security boundary. Verified: 25 Node tests and 3 Python tests pass, including the 16 original documentation checks.
- **Next:** Extension panel and ChatGPT adapter, web workspace, actual MCP transport integration, packaging and browser verification.

## System map
```text
Supported web text fields
    ↓ (MV3 content script: user-enabled, no password fields)
Local detector → span classifier → placeholder mapper
    ↓                         ↓
Inline VeilX UI          Local-only mapping vault
    ↓
User confirms / enabled policy applies masked text
    ↓
Browser sends user-controlled masked content

Extension UI ↔ settings/local metadata ↔ optional desktop app
                                   ↔ optional API ↔ Alexa+ skill

Session Shield (separate module): token-like text warning +
opt-in risk rules; no raw cookie/session harvesting.
```

## Boundaries
- **Local first:** detection, replacement, and reversible mapping happen on device by default.
- **Untrusted:** all website DOM content and third-party integrations.
- **Sensitive:** raw personal data, passwords, cookie values, session IDs and tokens must never enter logs/telemetry or Alexa requests.
- **Browser limits:** protection is scoped to supported, permissioned surfaces; no guarantee against all cookie theft, XSS, hostile extensions or OS compromise.
- **Alexa+ and TinyFish:** optional, separate, consent-based services; never receive originals or raw browser session material.

## Modules — update paths as they actually appear
| Module | Actual path | Status |
| --- | --- | --- |
| Detection + classification | `shared/privacy.mjs` | Local fixtures verified |
| Placeholder mapping | `shared/privacy.mjs` | Stability, collision, scope, expiry and non-restoration tests pass |
| Extension content script + overlay | TBD | Not verified |
| Session Shield | TBD | Not verified |
| Dashboard / settings | TBD | Not verified |
| Desktop companion | TBD | Not verified |
| Alexa+ adapter | `backend/app.py` | MCP tools registered; transport not yet exercised |
| Tests | `tests/app/`, existing `tests/*.test.cjs` | 28 checks pass |

## Decisions / changes
- **Initial:** A Grammarly-inspired *interaction pattern*, not Grammarly code or proprietary internals.
- **Initial:** MVP is a Chrome Manifest V3 extension with local masking and explicit user control.
- **Initial:** `PRO.md` is the product source of truth; revise this file only for implemented design and changed decisions.
- **2026-10-23:** Python API accepts aggregate counts only. Alexa+ is a frontend simulation backed by real MCP; no Amazon account linking. Current scope excludes desktop, cookies, TinyFish and hosting.

<!-- Codex: When something ships, update Current state, the relevant module path/status,
     and at most one short Decisions line. Remove obsolete entries. Keep ARC.md roughly
     one page; detailed tasks, edge cases and requirements belong in PRO.md. -->

# Hackathon MVP verification

Verified locally on 2026-10-23 with macOS, Node 24.19, Python 3.14, Chrome for Testing 156 and the actual unpacked MV3 extension. No source or fixture result is presented as an Amazon account integration.

## ECC verification loop

| Phase | Observed result |
| --- | --- |
| Build | `npm run build:app` creates the local website, extension and ZIP; `npm run build` regenerates the preserved architecture without changing its tracked artifacts |
| Types/syntax | Pyright: 0 errors / 0 warnings for the Python backend; esbuild parses and bundles the JavaScript entry points |
| Lint/format | Ruff passes for backend/tests/package script; Prettier checks pass for application JavaScript and browser tooling |
| Unit/regression | 29 Node tests pass, including the original 16 documentation checks; 6 Python checks pass |
| Browser | 12 Chromium checks pass, including actual extension loading, two textarea variants, rich-editor insertion and the normal-site automatic round trip |
| Core coverage | Shared engine/scope: **100% lines, 93.46% branches, 100% functions** |
| Backend coverage | **87.59% lines**; the actual HTTP simulator bridge is also exercised by browser integration tests |
| Dependencies | `npm audit` reports 0 known vulnerabilities; `pip check` reports no broken requirements |
| Packaging | ZIP integrity and the explicit 13-file runtime asset set are checked; original GPL license and bundled notices included |
| Sensitive-file review | Decision ledger, local project notes/backups, environments, dependencies, generated evidence and runtime caches excluded from Git |

## Meaningful TDD checkpoints

| Commit | Evidence |
| --- | --- |
| `ae05f29` | RED: privacy/backend contracts failed on missing implementations |
| `5bf1e1d` | GREEN: initial shared engine and aggregate-only backend passed their tests |
| `d2e060e` | RED: browser check reached the local server and failed on the absent private workspace |
| `8a545fe` | RED: tab/conversation lifecycle contract added before the shared scope implementation |
| `7278ccb` | RED: official SDK silently ignored extra tool arguments; strict MCP boundary regression exposed this |
| `00b4104` | RED: automatic site veiling, previously emitted tokens and guest-conversation contracts preceded their implementation |

Subsequent observed failures also caught ordinary order numbers being treated as phone numbers and rich-editor paragraph insertion changing newlines. The detector now requires context for bare mobile numbers; native line-break insertion preserves reviewed rich-editor text. Both cases have regression checks.

## Actual live ChatGPT walkthrough

Native Chrome UI, guest session, synthetic details only:

1. Typed a fictional name/email draft into ChatGPT’s real `#mobile-composer-prompt`.
2. Opened VeilX and connected the site with explicitly approved host access in the disposable test profile.
3. Observed the site draft change to `[PERSON_1]` / `[EMAIL_1]`; original values appeared in VeilX’s private composer.
4. Clicked ChatGPT’s normal Send button. The actual provider message contained placeholders.
5. Waited for the completed assistant reply and the guest `/uc/` route transition.
6. Observed ChatGPT retain placeholders while VeilX displayed the original fictional name/email automatically in its private restored reply.

The observed reply was “Hello! My name is [PERSON_1]. You can reach me at [EMAIL_1]. Nice to meet you!” in the provider and the corresponding readable name/email inside VeilX. The adapter uses the observed assistant role and completion attributes and binds late first-conversation navigation only to its still-connected completed reply.

Inspection of 41 captured POST requests from that sample found the conversation-update payload contained placeholders, with no tested original values or map-shaped fields. Inspection retained boolean checks instead of raw bodies. **This does not mean a website cannot observe original typing in its own editor.** The protected composer is the private entry path.

Earlier live attempts found real differences from the fixture: guest composer selectors, `/uc/` routes and assistant completion markup. Those failures were corrected rather than reported as successes.

## Security and behavior exercised

- Stable repeated values; credentials/manual/structured/NLP precedence; literal token reservation; Unicode offsets; partial, unknown and altered tokens; scope isolation and expiry.
- Credentials never restore. Clear session removes the stored map, and old placeholders no longer resolve. Closing or changing the connected tab clears its map.
- Fast normal Send cannot outrun replacement: the first attempt is blocked, a masked draft remains for review, and a second explicit Send produces a locally restored reply.
- Paused site mode and adapter failure paths retain the private/provider boundary. Interrupted output is not automatically restored; manual paste remains available.
- Password, OTP, payment, authentication and secret-marked fields are excluded. Direct content-script access to `chrome.storage.session` is denied.
- Existing unrelated provider drafts are preserved during protected-panel sends. New replies are collected from the originating round trip rather than the latest arbitrary assistant message.
- Website masking causes no POST request. The simulator sends only fixed intent/category counts to Python; a real SDK client calls MCP. Extra private fields are rejected over actual HTTP without being echoed.
- Strict CSP, safe text rendering, loopback host/origin protections, bounded bodies/counts, no request-body logging and no product console logging. Source review found no analytics, cloud detection, cookie/history permission, localStorage or sync storage.
- Native review popover, keyboard path, reduced-motion and pause controls; no horizontal overflow at 1440px or 390px. Wide/mobile screenshots were visually reviewed.

## Reproduce

Use the commands in [README.md](../README.md). Run `npm run build:app` before Python/browser tests. Browser tests start or reuse the loopback server. The explicitly synthetic editor is at `/assets/fixture.html`; `?guest=1` and `?rich=1` exercise observed selector and generic rich-editor variants.

The captioned website demo was discovered, rehearsed successfully, then recorded with `scripts/record-demo.mjs`. Its pasted reply is labeled synthetic/manual; its MCP response is real. The script and source are committed; generated recording/screenshots remain local under `dist/evidence/`.

## Limits and unchecked deployment paths

A signed-in ChatGPT account, other AI providers, Windows/Linux desktop walkthroughs, public hosting, production Amazon account linking, Web Store review and a formal penetration test were not performed. Python dependency vulnerability scanning was not performed; dependency consistency and npm advisories were checked. Automatic collection supports one active round trip per connected tab. Detection can miss information and provider markup can change. Judges still require repository access and the demo must be uploaded separately.

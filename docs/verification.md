# Graphical walkthrough verification

Date: 15 October 2026. Scope: the standalone `index.html` concept, its synthetic demonstration model, the CSP hash refresh helper, and review instructions. No existing product callers, fixtures, dependencies, exports, or application configuration existed in the initially empty folder.

## User journeys and test-first evidence

Journeys were derived from the attached product brief and the user's request for an HTML explanation before implementation:

1. Understand and step through local detection, redaction, and personal reply restoration.
2. Understand how TinyFish researches public policy and how findings change the risk badge and redaction mode.
3. Understand active-session cookie metadata, pasted-secret prevention, and scoped tracker blocking.
4. Inspect the privacy boundary and the intended integration without configuring an API key.

RED: `node --test tests/walkthrough.test.cjs` ran before `index.html` existed. Six tests executed and failed for missing walkthrough functions/artifact. The checkpoint commit is `bec1990` on `main`.

GREEN: after implementation, `node --test tests/walkthrough.test.cjs` passed all eight tests, with zero failures. Two additional checks cover CSP hashes and embedded-script parsing/internal navigation. The completion commit preserves the implementation alongside this report.

| Guarantee | Check | Result |
| --- | --- | --- |
| Repeated personal values use a consistent placeholder | Node model test | Pass |
| Repeated and unknown placeholders restore safely; partial placeholders remain untouched | Node model test | Pass |
| Synthetic session values are redacted and never restored | Node model test | Pass |
| Unknown policy findings fail to High/Strict; explicit no-training and opt-out score as specified | Node model test | Pass |
| The illustrated guard blocks only a known tracker when enabled; first-party and unknown traffic are allowed | Node model test | Pass |
| No remote assets, outbound API, cookie reads, or persistent browser storage in the artifact | Source invariant test | Pass |
| Inline scripts/styles match their exact authorized CSP hashes | Hash test | Pass |
| Embedded scripts parse; IDs are unique and internal navigation targets exist | Syntax/structure test | Pass |

## Coverage

Ran `NODE_V8_COVERAGE=/private/tmp/veilx-model-coverage node --test tests/walkthrough.test.cjs`, then inspected the V8 result for `walkthrough-core.js`: **7/7 functions and 16/16 recorded execution ranges covered**, no uncovered ranges. This covers the synthetic model only, not the UI script or production behavior.

Node's default experimental test-coverage table contained no source files for the VM script; its empty-table “100%” is not counted as coverage evidence. The raw V8 result above is the scoped measurement.

## Browser observations

Chrome DevTools opened the file directly. At a 1200px viewport, the document reported no horizontal overflow, scripts initialized, no external resource requests were recorded, and no warnings/errors appeared in the console.

Seventeen browser interaction assertions passed: detection highlights, outgoing redaction, reply visibility, personal restoration, replay/reset, cookie-secret redaction and non-restoration, all four policy scenarios, enabled/paused tracker simulation, duplicate-run disabling, five-step agent completion, and no external requests. Policy mode synchronization with the experience badge was added after that browser run and syntax/model checks reran; that final binding was source-reviewed rather than browser-retested.

Screenshot saving was rejected by the DevTools tool's configured output-root restriction. A screenshot returned without a destination stalled and was cancelled. The alternate browser surface rejected local-file inspection under its URL policy. No workaround was attempted after that policy rejection. **Screenshot-based visual review, mobile rendering, keyboard interaction, reduced-motion rendering, and cross-browser behavior are unverified.** Responsive styles, labels, focus indicators, semantic controls and reduced-motion handling are present and source-reviewed only. The final narrow-screen layout adjustment also received source review only.

## ECC verification loop

| Phase | Outcome |
| --- | --- |
| Build | No bundler required; standalone file, embedded scripts parse |
| Types | Not applicable: plain HTML/CSS/JavaScript, no TypeScript project |
| Lint | No project linter installed; syntax/structure and whitespace checks passed |
| Tests | 8/8 automated tests; 17 earlier browser interaction assertions; scoped model coverage above |
| Security | No real keys, credentials, remote assets, analytics, private input, network calls or persistent PII state; hash-based CSP denies connections; all rendered dynamic content uses text nodes |
| Diff | Reviewed artifact, documentation, tests, CSP helper and ignore file; no pre-existing application files to alter |

## Boundaries and remaining work

- All policy claims, provider replies, cookie objects, and network decisions are fictional simulations.
- No production detector, cookie store, extension, backend, live TinyFish integration, or provider send interception is implemented.
- Real cookie enforcement, sign-in compatibility, provider DOM adapters, and actual policy evidence require integration testing in the later build.
- Full `pro.md`, `arc.md`, and `design.md` specifications remain deferred in favor of the user's HTML-first direction.
- The GitHub connector and local HTTPS authentication could not access this repository. Rechecking the existing SSH connection used by Icarus successfully fetched `aaravkalia-88/veilX`. Publishing now uses that authorized SSH connection. The remote initial commit and its GPLv3 LICENSE are preserved; its one-line README is expanded with the walkthrough instructions. No unrelated repository was changed.

# Extended system graph verification

15 October 2026. Scope: architectural documentation and an offline graph explorer. No extension, backend, actual PII detector, cookie enforcement or live TinyFish integration is implemented.

## Scope and source of truth

The user's reference called for a detailed component/dependency graph rather than a landing page. The new primary `index.html` embeds a diagram with 106 nodes, 182 labeled directed edges and 13 groups. Each component has a proposed module, responsibility, trust boundary and phase. The earlier HTML was moved unchanged to `walkthrough.html`; its tests now target that path. README, exports, source model, build script, dependency lock and this report are included in scope. Existing license and history are preserved.

The editable graph is `docs/architecture.json`. The Graphviz source, SVG and main HTML are generated from it and `docs/map-shell.html`. Proposed module paths refer to the future application, not existing implementations.

## Test-first evidence

- RED: six architecture tests ran before the graph model/explorer existed and failed for missing components, paths, boundaries and graph output. Checkpoint `6fed436` preserves that state.
- GREEN: `npm test` passes 16/16 tests: eight architecture checks and the eight preserved walkthrough checks. There are no failures or skips.
- Tests assert completeness, unique nodes, connected components, valid labeled endpoints, required PII/restore/TinyFish/cookie paths, local-only raw-data edges, all SVG nodes/edges present, accessible HTML nodes, static SVG without inactive controls/scripts, nonempty traces, direct-neighbor selection, literal/empty search, valid scripts and exact CSP hashes.
- Raw V8 coverage from `NODE_V8_COVERAGE=/private/tmp/veilx-graph-coverage node --test tests/*.test.cjs`: `graph-core.js` has 8/8 functions and 14/14 execution ranges covered; the prior walkthrough model has 7/7 functions and 16/16 ranges covered. This does not measure the UI event script or the future product.

## Browser checks

Served the new graph over localhost HTTP, using the browser's supported protocol. No local-file browser-policy workaround was attempted for the earlier artifact.

Twenty desktop assertions passed at 1440 × 1000: 106 node and 182 edge groups; no horizontal overflow; all six feature traces; full-diagram reset; search and selection; direct connection details; empty-search feedback; zoom in, fit and actual size; keyboard inspection and Escape; no external resource loads. Browser console had no warnings or errors.

Real pointer clicking initially revealed a pointer-capture bug: clicks were retargeted to the root SVG. Fixed capture to stay on the original shape. A real browser click then opened “Protected prompt composer,” its proposed module and five direct connections. Screenshots of the overview and selected component were visually inspected through the in-app browser at its narrow viewport.

Chrome window resizing clamped at 500px, so mobile evidence uses device emulation instead: **390 × 844** and **320 × 720** both report their actual intended viewport width and no horizontal overflow; the graph remains visible, and the inspector stacks below it at 390px. Desktop emulation was restored afterward. Physical-device touch/pinch, complete screen-reader behavior, reduced-motion rendering and non-Chrome browsers remain unverified.

## ECC verification loop

| Check | Result |
| --- | --- |
| Build | `npm run build` succeeds with no Graphviz warnings/errors; output is offline SVG/HTML |
| Syntax/types | Embedded JavaScript parses in tests; no TypeScript application exists |
| Lint/structure | No configured linter; syntax, unique IDs, graph references, CSP hashes and whitespace checks pass |
| Tests | 16/16; scoped core coverage and browser evidence above |
| Dependency security | `npm audit --audit-level=high`: 0 vulnerabilities; one pinned build-only dependency, no install scripts required |
| Data boundary review | Raw PII and inspected cookie-value edges stay local; no maps/cookies sent to backend or TinyFish; native first-party authentication is explicitly separate |
| Browser security | Hash-authorized scripts/styles, `connect-src 'none'`, no remote assets/API calls/analytics/persistent state; search and details use text nodes |
| Exports | Static SVG has all 106 components and 182 edges with descriptions; interactive controls live only in HTML; editable DOT is included |

## Product-design limits

Raster export: `docs/veilx-system-map.png` was rendered directly from the complete SVG at 6000 × 8312 pixels and tagged 300 DPI. Metadata and aspect-ratio assertions passed; the full image and a detail crop were visually inspected. PNG size is 3,706,798 bytes. No PowerPoint/PDF document was created or tested for placement. The SVG remains the vector source; the PNG is a snapshot of this version.

The graph describes intended behavior, not verified product protection. Detection can miss data. Protected composition/restoration requires extension-owned UI; provider DOM cannot safely hold originals under a promise that the provider never sees them. Cookie metadata is not a vault, known-tracker rules are not arbitrary exfiltration detection, and native login can identify the user. Names/places NER is phase 2 with manual marking in the first phase; opt-out automation is stretch and requires separate consent/execution design. Exact TinyFish events/preview, real provider adapters, permissions, deployment and every future acceptance-test node still require implementation and integration testing.

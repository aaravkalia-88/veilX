# VeilX

### Your data stays yours.

**A local privacy round trip for AI conversations: Original → Protected → Restored.**

Built for the **Alexa+ track** of [Build, Ship, Shape: Amazon Developer Hackathon](https://amazonappdev2026.devpost.com/). VeilX pairs a working Chrome privacy companion with a real Python MCP server and an explicitly labeled Alexa+ web simulation.

**Live on Vercel:** [veilx-kappa.vercel.app](https://veilx-kappa.vercel.app/) · [Download Chrome extension](https://veilx-kappa.vercel.app/download/veilx-extension.zip)

[Quick start](#quick-start) · [Chrome installation](#install-the-chrome-extension) · [Alexa+ integration](#the-alexa-demonstration) · [Demo script](docs/demo-script.md) · [Verification](docs/mvp-verification.md) · [Architecture](ARC.md)

## Solo contribution

I built VeilX end to end as a solo developer during a short hackathon sprint, covering the local privacy engine, Chrome extension, website, FastAPI backend, MCP tools, tests, and Vercel deployment. I used Python, JavaScript, Chrome Manifest V3, compromise, Tailwind CSS, Motion, esbuild, Playwright, and pytest, with GitHub for version control and Codex for development assistance.

## The idea

Useful AI prompts often contain details an AI does not need: a name, contact address, phone number, identifier or pasted credential. VeilX replaces detected details with consistent placeholders, keeps the mapping on your device, and brings personal details back into the completed answer locally.

```text
You write:    My name is Maya Sharma. Email maya@example.com.
AI receives: My name is [PERSON_1]. Email [EMAIL_1].
AI replies:  Hello [PERSON_1], I'll use [EMAIL_1].
VeilX shows: Hello Maya Sharma, I'll use maya@example.com.
```

The readable answer appears **inside VeilX**. ChatGPT’s page retains placeholders. Secrets and session credentials stay masked even in the local reply.

## What works

- **Activate and continue:** connect VeilX on ChatGPT to veil an existing eligible draft, then keep replacing detected details during later typing. Use the website’s normal Send button; VeilX collects the newly completed reply and restores it in its private panel.
- **Private composition:** type directly in the extension-owned composer to keep originals out of the provider’s editor. Local automatic preview, manual selection/classification, detection review, copy, undo and Clear session are available.
- **Shared local engine:** bundled `compromise` suggestions plus structured patterns for email, phone, contextual birth dates/IDs, card shapes and common credentials. Repeated values have stable tokens; literal tokens are reserved; exact known personal-information tokens alone restore.
- **Temporary maps:** restricted extension session storage, scoped to one tab and conversation. Website maps remain in page memory. Reset, conversation change, tab closure, browser restart and inactivity invalidate mappings.
- **Real backend integration:** FastAPI serves the website and extension ZIP; the simulator invokes actual MCP tools over Streamable HTTP through the official Python SDK. No API key, database or cloud detection service is required.

**Two entry modes have different privacy boundaries.** A website can observe text typed into its own editor before VeilX replaces it. Use the private composer for private entry. Detection can miss information, so review the protected text before sharing.

## Quick start

Verified locally with **Node 24.19, Python 3.14 and Chrome 156**. The extension requires **Chrome 135+**.

```sh
git clone --branch feat/hackathon-mvp https://github.com/aaravkalia-88/veilX.git
cd veilX
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock
npm ci
npm run build:app
npm start
```

Open **http://127.0.0.1:8000**. Local startup binds to loopback and does not log request bodies. The simulator uses the official SDK's Streamable HTTP transport against the mounted MCP application, so it also works inside a serverless function without a separate listener on port 8000.

### Deploy on Vercel

The [live production site](https://veilx-kappa.vercel.app/) is available without credentials. All 12 production checks passed, including the extension ZIP, MCP protocol handshake and tool calls, and rejection of unsupported private-text fields and untrusted origins.

Import this repository with **Root Directory `./`**, select **`feat/hackathon-mvp`**, and use the **FastAPI** framework preset. Keep the Output Directory override disabled. The committed `vercel.json` builds the website and extension ZIP; root `app.py` exposes the Python application. Python 3.14 is pinned in `.python-version`.

The backend explicitly trusts the current deployment and production domains from `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL`, while retaining MCP Host/Origin checks. For a custom domain, set **`VEILX_PUBLIC_ORIGIN=https://your-domain.example`** and redeploy. Other projects' domains remain rejected.

After deployment, check `/healthz`, `/download/veilx-extension.zip`, and the Alexa+ simulator's **Summarize this protection** button. The real external MCP endpoint remains `/mcp`. The deployed website processes drafts locally; the extension still connects only to ChatGPT and local demo pages.

## Install the Chrome extension

1. Click **Download Chrome extension** on the local website. The build also creates `dist/veilx-extension.zip`.
2. **Extract** the ZIP into a folder.
3. Open `chrome://extensions`, enable **Developer Mode**, select **Load unpacked**, and choose the extracted folder containing `manifest.json`.
4. Open ChatGPT, select VeilX from Chrome’s extensions menu, then **Connect current site** and approve the optional ChatGPT site access.
5. Review the replaced site draft, then send normally. The completed reply returns automatically to VeilX’s **Restored** section.

For stronger privacy, start in the private composer and choose **Send protected to ChatGPT** after review. Unrelated provider drafts are preserved. If Send outruns the local replacement delay, VeilX blocks that attempt, updates the draft, and asks you to review and send again.

**After code changes:** rebuild, choose **Reload** on VeilX’s card with Developer Mode enabled, then reconnect. Keep the extension panel open during automatic reply collection. Reopening it can recover a still-pending map; manual paste-to-restore remains available.

## The Alexa+ demonstration

This project uses the hackathon’s **MCP + simulated experience** path. The website is a simulation; it does not link an Amazon account, invoke a microphone or claim a deployed Alexa skill.

```text
Frontend simulator → POST /api/assistant → official MCP SDK client
                   → Streamable HTTP /mcp → actual tool result
```

| MCP tool | Accepted input | Output |
| --- | --- | --- |
| `get_protection_capabilities()` | None | Supported categories and clear limitations |
| `summarize_protection(counts_by_type, unresolved_count)` | Enumerated categories and strict integers from 0 to 100,000 | Actual aggregate totals, credential count and review summary |

The real `/mcp` endpoint is initialized with protocol **2025-11-25** in the HTTP acceptance test. Python rejects extra fields, unsupported categories, booleans and invalid counts; it accepts no prompt, identifier, map, credential or browsing-history fields. Validation errors do not echo rejected values.

The mounted server’s session-manager lifespan follows the [official MCP SDK ASGI integration](https://py.sdk.modelcontextprotocol.io/run/asgi/). The simulation’s displayed result comes from a real tool call, with no fabricated AI response.

## Verify it

```sh
npm run build:app
npm test
npm run test:core
.venv/bin/python -m pytest tests/app/test_backend.py --cov=backend --cov-report=term-missing --cov-fail-under=80
.venv/bin/ruff check backend tests/app/test_backend.py
npx playwright install chromium
npm run test:browser
```

The original 16 architecture checks are retained. Additional checks cover token collisions, Unicode offsets, overlap priority, exact restoration, credential suppression, expiry/scope isolation, actual loaded-extension workflows, protected normal Send, interrupted replies, excluded fields, keyboard use, 1440px/390px layouts and real MCP HTTP calls.

**Live evidence:** a native Chrome walkthrough on guest ChatGPT replaced a fictional name/email in its actual editor, used its normal Send button, and restored the completed reply locally. Captured conversation POSTs contained the tested placeholders and no tested originals or map fields. Local fixture success is recorded separately; a signed-in ChatGPT account was not live-tested. See [exact results and TDD evidence](docs/mvp-verification.md).

## Demo in under three minutes

Follow the [2:40 demo script](docs/demo-script.md). To reproduce the captioned website recording while the server runs:

```sh
node scripts/record-demo.mjs --discover
node scripts/record-demo.mjs --rehearse
node scripts/record-demo.mjs
```

The local recording is `dist/evidence/veilx-demo.webm`. It labels its manual sample reply as synthetic; its MCP result is real. The separate `/assets/fixture.html` test editor is explicitly **not ChatGPT**.

## Architecture and repository

| Path | Responsibility |
| --- | --- |
| `shared/` | Shared detector, placeholder engine and tab/conversation scope |
| `extension/` | MV3 worker, restricted session storage, protected panel, hints and ChatGPT DOM adapter |
| `ui/` | Shared workspace/controller, original shield mark and compiled CSS source |
| `web/` | Local website, Alexa+ simulator and labeled adapter fixtures |
| `backend/app.py` | FastAPI host, strict metadata boundary, SDK client and real MCP tools |
| `scripts/` | Reproducible application/ZIP builds and demo recording |
| `tests/` | Privacy, backend, browser and preserved architecture checks |

See [ARC.md](ARC.md) for implemented architecture and [PRO.md](PRO.md) for the supplied broader product specification. The [reference study](docs/implementation-references.md) explains the original Grammarly-inspired interaction design and 21st.dev visual references.

**What changed for the hackathon:** the repository originally contained an offline architecture graph and concept walkthrough. This branch adds the runnable local engine, extension, website, FastAPI/MCP integration, packaging and regression tests. The original [graph](index.html), [walkthrough](walkthrough.html), exports and [historical guide](docs/system-map-guide.md) remain intact; their broader proposed modules are not claims of implemented features.

## Supported limits

- Detection uses language suggestions and common patterns, not a guarantee of finding every private value. Names/addresses can be missed or misclassified; manual marking is available. Ordinary numbers are not automatically private.
- Only ChatGPT and connected local demo pages are supported. Password, OTP, payment/authentication and secret-marked fields are excluded. Nested iframes and closed shadow editors are unsupported.
- DOM changes, interruptions and altered/unknown placeholders can require manual restoration. Provider account identity, the OS, and other extensions remain outside VeilX’s protection boundary.
- Maps expire after **30 minutes of inactivity**. Restoration rejects an expired map immediately; the worker’s periodic alarm removes inactive storage within about a minute. Website reloads lose their memory-only map.
- The extension’s local engine works offline. Live ChatGPT needs internet; the Alexa+ simulator needs the Python backend, available locally or on Vercel. Extension activity is not synced into the website’s counts.
- Desktop companion, cookie access, TinyFish, OAuth, database, Chrome Web Store publication and Amazon account linking are outside this MVP. Vercel production hosting is verified at the live demo link above.

## Submission notes

The [hackathon requirements](https://amazonappdev2026.devpost.com/) request working source, a demo under three minutes and product/tool feedback. This repository supplies runnable source, a demo script and [implementation feedback](docs/implementation-references.md). The demo still needs to be uploaded to the submission platform, and judges need access to the repository. VeilX does not change repository visibility or send collaborator invitations automatically.

The original [GPLv3 license](LICENSE) is preserved. Bundled third-party notices ship with the extension ZIP.

# Vercel deployment fix

The local MVP had no supported Vercel Python entrypoint, used the architecture-map build by default, rejected public hosts/origins, and required a separate MCP listener on port 8000. The user's deployment target is Vercel; its connector denied access to the team's deployment logs, so the specific remote failure was not inspected.

The fix adds root `app.py`, the FastAPI preset, an explicit website/ZIP build with development build tools included, packaged `dist` assets, and a tested Python version. FastAPI and the MCP SDK trust only localhost and explicitly configured deployment origins. The simulator uses the SDK's Streamable HTTP client with an ASGI transport against the real mounted `/mcp` endpoint, avoiding an outbound or loopback socket. Counts-only validation and the application-owned MCP lifespan remain active.

## TDD and verification

- RED: `python -m pytest tests/app/test_backend.py -q -k 'vercel or loopback'` executed three regressions: missing deployment configuration, a 503 with loopback connections disabled, and a rejected Vercel hostname. All three failed before implementation. Checkpoint: `0004817`.
- GREEN: the same three tests passed after the fix.
- Full backend suite: 9 tests passed; backend line coverage 90.73%, above the 80% requirement.
- Backend Ruff checks and formatting passed.
- `npm run build:app` and all 29 JavaScript/documentation tests passed.
- The hosted-domain regression checks health, homepage, CSS, extension download, SDK summary, external MCP initialization, and rejection of an unrelated Vercel project and untrusted origin.

Live Vercel build/runtime verification remains pending. Redeploy `feat/hackathon-mvp` with repository root `./`, FastAPI preset, and no Output Directory override. For a custom domain, configure `VEILX_PUBLIC_ORIGIN` as its exact HTTPS origin. See the README for setup.

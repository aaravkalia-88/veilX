# VeilX — Hackathon Friction Log

Recorded on October 23, 2026. These entries describe observed behavior and local regression tests, not hypothetical incidents. Test values were synthetic; no private-data exposure was observed.

## 1. Unknown MCP tool arguments were silently ignored

- **Task attempted:** Enforce VeilX's counts-only input contract using the official MCP Python SDK 2.3.0.
- **Steps taken:** Defined typed tools and submitted valid arguments plus an unexpected synthetic `draft` field.
- **Expected result:** Reject the request because an unsupported field was present.
- **Actual result:** The SDK ignored the extra argument and continued the tool call.
- **Severity:** Medium. This conflicted with the project's strict input contract; it was not an observed data leak.
- **Workaround used:** Added middleware that rejects unknown arguments before tool execution, with regression tests.
- **Actionable suggestion:** Provide a documented strict-argument mode that rejects unknown fields, with a privacy-focused example.
- **Evidence:** [Backend validation and regression tests](../tests/app/test_backend.py), including `test_mcp_rejects_extra_private_fields`; [implementation notes](implementation-references.md).

## 2. Local MCP configuration did not transfer directly to serverless hosting

- **Task attempted:** Run VeilX's FastAPI website and MCP simulator on Vercel.
- **Steps taken:** Tested a Vercel deployment hostname and disabled separate loopback connections to reproduce serverless constraints.
- **Expected result:** The application would accept its deployment hostname and return a real MCP protection summary.
- **Actual result:** Local-only Host/Origin checks rejected the hostname, and the simulator's separate port-8000 dependency returned an unavailable response. The repository also lacked a discoverable Vercel Python entrypoint and the correct application build configuration.
- **Severity:** High. These project configuration assumptions blocked the hosted workflow.
- **Workaround used:** Added the FastAPI entrypoint and build configuration, explicit deployment-domain allowlists, and the official SDK's Streamable HTTP client over ASGI against the mounted MCP endpoint.
- **Actionable suggestion:** Publish a complete Python MCP serverless example covering entrypoints, build assets, lifespan ownership, Host/Origin checks, and calls to a co-hosted endpoint.
- **Evidence:** [Deployment fix and RED/GREEN results](vercel-deployment-fix.md), [regression tests](../tests/app/test_backend.py); reproducer commit `0004817`, fix commit `5fe5f6e`.

**Verification limit:** All three deployment regressions passed after the fix. The full backend suite passed 9 tests with 90.73% line coverage. Live Vercel deployment was not verified: the connector denied team-scope access to deployment logs.

VeilX uses a real MCP server and a frontend Alexa+ simulation. No Amazon account linking or AWS service deployment was performed, so this log does not claim experience with those workflows.

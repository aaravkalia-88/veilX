# Reference study and implementation choices

The implementation uses original VeilX code and artwork. No proprietary Grammarly code, private APIs, branding or protected assets were copied.

| Evidence | Observed pattern or requirement | VeilX implementation and check |
| --- | --- | --- |
| [Supplied Grammarly URL](https://www.grammarly.com/extension-success?utm_medium=navigation&utm_source=chrome), inspected through the installed REA CLI | Redirected to signup; installed extension internals were not available | Public behavior study only. REA evidence `ev_cfc17804b5422763c6a6bf76e44958faf7129f996ca4d0b510fd1db5786e1167` records the redirect |
| [Grammarly browser-extension help](https://support.grammarly.com/hc/en-us/articles/360003816032-How-to-use-Grammarly-in-your-browser) | Badge/count, compact review and user control | Local badge/popover, review/ignore, site controls, manual marking and protected composer; browser tests cover activation and exclusions |
| [21st.dev component library](https://21st.dev/community/components), [button references](https://21st.dev/community/components/explore/shimmer-button) | Clear landing-page hierarchy, compact controls, hover/press feedback and restrained motion | Original light HTML/CSS layout, flat mint/coral geometry and Motion reveals. No React, remote component code, 3D runtime or external assets loaded |
| [Motion JavaScript docs](https://motion.dev/docs/animate), [inView](https://motion.dev/docs/inview) | Small compositor-friendly reveals | Bundled Motion; reduced-motion, user pause, visible content without animation; keyboard and motion browser checks |
| [Official MCP SDK ASGI integration](https://py.sdk.modelcontextprotocol.io/run/asgi/) | One session-manager lifespan for a mounted Streamable HTTP server | FastAPI lifespan owns `mcp.session_manager.run()`; actual HTTP initialization and tool calls are tested |
| [Official hackathon rules](https://amazonappdev2026.devpost.com/rules) | Working accepted integration, source access and short demonstration | Real MCP endpoint with `2025-11-25` handshake plus clearly labeled frontend simulation; no claim of Amazon account linking. Judges still require repository access |
| Actual ChatGPT guest UI, 2026-10-23 | `#mobile-composer-prompt`, normal Send button, `/uc/` conversation routes, assistant role/completion attributes | Corrected the adapter using observed DOM behavior. Verified masked normal submission and completed local restoration in native Chrome, separately from fixtures |

Modern Web Guidance applied: `privacy`, `declarative-dialog-popover-control`, and `motion`. Mappings use page memory or trusted extension session storage; browser-native review controls handle keyboard dismissal; movement uses opacity/translation and respects motion preferences.

## Tool feedback from this implementation

- **Official MCP Python SDK 2.3.0:** its official client and ASGI transport enabled a real local tool round trip quickly. Mounting needs one correctly owned session-manager lifespan. Typed structured return annotations were necessary for the expected tool result; unknown function arguments were silently ignored by default, so VeilX added strict middleware and a regression test. We would use the SDK again with those boundaries explicit. A documented strict-extra-argument option would improve this use case.
- **Chrome MV3:** extension-owned UI and restricted session storage fit the privacy boundary well. Development onboarding was less obvious: a browser restart retained an old worker, and Reload disabled the unpacked extension while Developer Mode was off. The README now explains the correct reload sequence. We would use MV3 again, while limiting site adapters to tested markup.
- **Alexa+ developer experience:** this build uses the permitted frontend-simulation/MCP path. We did not deploy or link an Amazon account and cannot evaluate production account-linking or console onboarding from this implementation. The public simulation route made a demonstrable integration possible without claiming access we did not have.
- **AWS services:** none were used. VeilX does not claim the AWS Builder mini challenge.

# VeilX demo — 2 minutes 40 seconds

Use fictional data only. Start the server and load the extracted extension in Chrome before recording. Pin VeilX, use a fresh ChatGPT chat, and keep the side panel wide enough to read. The observed live guest interface works without an Amazon account or API key; sign-in or availability can vary.

| Time | Action and narration |
| --- | --- |
| 0:00–0:20 | Show the light landing page. “VeilX puts a private layer between your details and an AI prompt. Original → Protected → Restored.” |
| 0:20–0:45 | In ChatGPT, type a fictional draft: `Write a short greeting. My name is Maya Sharma. Email maya@example.com. Keep every bracketed placeholder unchanged.` Open VeilX and Connect current site. Show the editor replacing details with `[PERSON_1]` and `[EMAIL_1]`. “This convenience mode changes an existing site draft. The site may already have observed the original typing.” |
| 0:45–1:15 | Review the placeholders, then use ChatGPT’s normal Send button. Wait for completion. Show the provider reply retaining tokens and VeilX’s private reply showing Maya Sharma and the fictional email. “The readable answer returns locally. Originals are never inserted into ChatGPT’s reply DOM.” |
| 1:15–1:40 | Point to the protected composer. “For private entry, start here instead of typing into the website. Detection and the map stay local.” Show automatic preview, review, manual marking and Clear session. Explain that credentials remain masked even in restored replies. |
| 1:40–2:15 | On the local website, load the fictional sample and mask it. Choose Summarize this protection. Show the tool name and Streamable HTTP result. “This is an Alexa+ frontend simulation calling a real MCP endpoint through the official SDK. It sends counts only, with no Amazon account linking.” |
| 2:15–2:40 | Show Download Chrome extension and installation instructions: ZIP → Extract → Developer Mode → Load unpacked. Close with limits: suggestions can miss data, private mappings expire, and manual paste-to-restore remains available if a website changes. |

## Recording and fallback

`node scripts/record-demo.mjs --discover` inventories the actual controls. Run `--rehearse`, then record with no flag. The captioned website recording is saved under `dist/evidence/veilx-demo.webm`; it clearly labels its sample masked reply as manual/synthetic. Its MCP result is a real HTTP tool result.

The local adapter fixture at `/assets/fixture.html` is explicitly synthetic, including `?guest=1` and `?rich=1` variants. Do not present it as a live ChatGPT response. If live ChatGPT is unavailable, disclose that and show the fixture plus manual restoration instead.

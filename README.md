# ChatDump

A browser bookmarklet that exports your **ChatGPT**, **Gemini**, and **Claude** conversations to **Markdown**, **HTML**, and **plain text** — complete, faithful, and in your language.

One click on a conversation page gives you a toast with six actions: save or copy the transcript in any of the three formats. No extension, no server, no data leaving your browser: the bookmarklet talks to the same first-party APIs the chat app itself uses, with your existing session.

## Why API-first

All three platforms **virtualize the message list**: the DOM only holds the messages around your scroll position (claude.ai keeps ~12, ChatGPT and Gemini unload off-screen turns). Any exporter that scrapes the page silently drops the rest of a long conversation.

ChatDump therefore extracts the conversation from each platform's own **same-origin API** and only falls back to DOM scraping when the API is unavailable:

| Platform | Primary extraction | What you get |
| --- | --- | --- |
| **Claude** | `/api/organizations/{org}/chat_conversations/{uuid}` (org UUID from the `lastActiveOrg` cookie, `/api/organizations` fallback) | Every turn, prompt attachments **with their extracted text content**, artifact sources as fenced code blocks, tool-use markers |
| **ChatGPT** | `/backend-api/conversations/{uuid}?include_has_versions=true&num_turns=100`, following `page_info.start_cursor` backwards (`&before=<cursor>`); legacy `/backend-api/conversation/{uuid}` as fallback (bearer token from `/api/auth/session`) | Every page, deduplicated and in order; the active branch (checked against `current_node`); assistant tool/code chains merged into one response; attachments; citations as links; models and timestamps |
| **Gemini** | `batchexecute` RPC `hNvQHb` (auth token from `WIZ_global_data`) | All turns via cursor pagination, the regenerated draft actually continued (parent-pointer match), attachment file names |

Model *thinking* / hidden system messages are excluded on all platforms by design: the export is the conversation, not the model's chrome. Reasoning filtering is unchanged: short assistant preambles such as "I'll check…" that ChatGPT records as visible messages are exported with the response.

The **DOM fallback** still works on every platform (and is what the offline test harness exercises): it clones `document.body`, extracts turns with platform-specific selectors, strips UI chrome (buttons, screen-reader labels, copy-code decorations), and preserves attachments and artifact/tool chips as inline markers.

### Completeness is explicit

Every export carries an **Export notice** (Markdown, HTML and TXT) and the toast turns amber when it applies:

- **DOM fallback** is always labelled as possibly incomplete, with the reason the API retrieval failed. It is never presented as a verified export.
- **ChatGPT API retrieval** states how many pages and messages were read and that the start of the conversation was reached, or lists what went wrong: no `page_info`, a repeated or missing cursor, the 1000-page / 200000-message safety limits, duplicate ids with differing content, `current_node` missing or not last (trailing messages from another branch are left out and counted), sibling versions sharing a parent, cycles, or a missing parent in a tree payload. An unresolvable `current_node` in a tree payload aborts the API path (DOM fallback, labelled) instead of guessing a branch.
- Requests are bounded: 15 s per request and 90 s overall, both cancelled with `AbortController`.

The **DOM fallback** still works on every platform (and is what the offline test harness exercises): it clones `document.body`, extracts turns with platform-specific selectors, strips UI chrome (buttons, screen-reader labels, copy-code decorations), and preserves attachments and artifact/tool chips as inline markers.

### ChatGPT retrieval limitations

- The endpoint, its `before=<start_cursor>` parameter and the payload shapes are undocumented and were taken from the community write-up ([discussion 204601](https://github.com/orgs/community/discussions/204601#discussioncomment-18431658)); they can change at any time, and the parameter name has not been confirmed against a live account.
- In the paginated message-list format, `metadata.parent_id` often points at structural nodes that are not messages, so a parent that is not among the messages is not treated as an error. Cycles and sibling versions sharing a parent are reported; how `include_has_versions` marks alternate versions is not modeled, so a version selection that the server resolved silently cannot be verified.
- Reasoning/preamble filtering is unchanged: records on an `analysis` channel or with an internal recipient are not filtered.
- Claude and Gemini retrieval is unchanged: no pagination, completeness check or independent active-branch traversal.

## Export anatomy

Every format shares the same scaffolding:

- **H1** — the conversation title.
- **Provenance line** — localized, right under the title: tool link, creation date in your browser locale, and the URL of the original conversation.
- **Escaping** – titles, attachment names, headers and link targets inserted into the HTML export are HTML-escaped; links are limited to `http(s)` URLs, and Markdown/TXT titles and attachment names are kept on one line.
- **Export notice** – see above.
- **Citations** – ChatGPT `genui` markers are replaced by `([site](url), …)` through `metadata.content_references` (all sources and supporting websites; `utm_source=chatgpt.com` removed). Older `cite`/`entity` markers and `【n†source】` brackets are handled too. Unresolvable markers stay visible as `[Citation unresolved: <ids>]`; no URL is ever constructed. Code blocks, inline code and your own prompts are left literal.
- **H2** — one per turn: `Human Prompt {n}` / `LLM Response {n}` (localized).
- **Turn content** — headings authored by the LLM are demoted to start at H3 (relative hierarchy preserved, fenced code untouched), so they never collide with the turn scaffolding.
- **Markers** — one-liners for non-text events: `> [Attachments: ...]`, `> [Artifact: title]` (followed by its source when available), `> [Tool: ...]`.

The TXT export carries the same content with plain-text separators instead of Markdown headers.

## Localization

UI strings and export labels are localized in the 10 most spoken languages — English, Mandarin Chinese, Hindi, Spanish, French, Arabic, Bengali, Portuguese, Russian, Urdu — plus Italian, selected automatically from `navigator.language` (English fallback, RTL layout for Arabic and Urdu). The export-notice and unresolved-citation strings are English only and fall back to English in every locale.

## Installation

Copy the contents of [`dist/chatdump.bookmarklet.js`](./dist/chatdump.bookmarklet.js) into the URL field of a new browser bookmark. Alternatively, visit the [ChatDump web page](https://www.mauriziofonte.it/blog/post/chatdump-bookmarklet.html) and drag the bookmarklet link to your bookmarks toolbar.

Then open a conversation on a supported platform and click the bookmark. The toast appears immediately in a loading state while the conversation is fetched (requests are cancelled after 15 s each / 90 s overall; on timeout or any API error the DOM fallback takes over), then shows the export buttons.

The bookmarklet only runs on `https://` pages of exactly `chatgpt.com`, `www.chatgpt.com`, `chat.openai.com`, `claude.ai`, `www.claude.ai` and `gemini.google.com`.

> **Heads up!** As with any bookmarklet, review the source before installing it. `npm run verify` rebuilds from `src/` and fails unless `dist/` matches byte for byte.

> **Embedding the bookmarklet in HTML.** Spaces, `%`, `#`, `<`, `>` and control characters are percent-encoded; quotes, backslashes, braces and brackets stay raw (escaping them as `encodeURI` does would add ~14KB). Spaces must be encoded because Safari silently drops raw spaces from a pasted `javascript:` URL, which breaks the code with `SyntaxError: Unexpected token '{'`. Pasting into the bookmark URL field works as is; to embed the file in an `href`, escape `"` as `&quot;` first.

## Building from source

```bash
git clone https://github.com/mauriziofonte/chat-dump-bookmarklet.git
cd chat-dump-bookmarklet
npm install
npm run build   # writes dist/chatdump.bookmarklet.js and prints its SHA-256
npm run verify  # rebuilds in memory and fails if dist/ differs
npm test
```

The build bundles and minifies with `esbuild` (evergreen-browser targets: the chat platforms themselves require nothing less), prefixes `javascript:void`, encodes (see `encode.js`), and writes `dist/chatdump.bookmarklet.js`. It **fails hard** if the encoded output exceeds the 62KB bookmarklet URL limit; current size is ~51KB, most of it the i18n tables. To save space, the build stores spaces in the message tables as `~` and `t()` restores them (a space costs 3 bytes once encoded, `~` one).

## Development and testing

Everything runs offline against fixtures — no live account needed.

**DOM fixtures.** Open a conversation, save the full page as HTML in the project root named `<platform>-<n>.html` (e.g. `claude-1.html`). These files are gitignored.

**Regression tests** (`npm test`, Node's built-in runner plus `jsdom`; no live account needed) cover the HTML-export escaping, hardening (hosts, redirects, timeouts, Blob URLs) and ChatGPT retrieval (pagination, duplicates, cursors, branches, completeness notice) and citations (`test/*.test.mjs`). `test/fixtures/chatgpt-paged-synthetic.json` is a synthetic paginated ChatGPT payload (invented content, `example.*` domains) mirroring the record shapes of real payloads.

**Test harness** (`jsdom`-based, plain Node scripts):

```bash
node test/verify.js         # real parsers against every HTML dump, prints extracted items
node test/dump-all.js       # full pipeline, writes .md/.html/.txt exports to /tmp/chatdump-out/
node test/ui-smoke.js       # toast UI (loading/error/export states) and filename generation
node test/remote-claude.js  # Claude API path against a mocked fetch
node test/remote-chatgpt.js # ChatGPT API path (session token, branch linearization) against a mocked fetch
node test/remote-gemini.js  # Gemini batchexecute path (envelope, pagination, drafts) against a mocked fetch
node test/e2e-dist.js       # decodes dist/ and executes the real bookmarklet against the dumps
node test/meta-build.mjs    # per-module bundle size breakdown
```

`test/e2e-dist.js` also simulates the platforms' **Trusted Types** enforcement (`require-trusted-types-for 'script'`) by making `innerHTML` and `DOMParser.parseFromString` throw: the whole pipeline must work without ever re-parsing HTML from strings. This is a hard constraint on all code touching the live page — parsers hand **DOM nodes** to the processor, and the toast is built with `createElement`.

For in-browser debugging, decode the bundle and paste it into the DevTools console of a conversation page:

```bash
node -e "console.log(decodeURIComponent(require('fs').readFileSync('dist/chatdump.bookmarklet.js','utf8').slice('javascript:'.length)).replace(/^void /,''))"
```

Runtime failures are logged with the `[ChatDump Error]` prefix and surfaced in an error toast; remote-extraction fallbacks log a `[ChatDump]` warning.

When reverse-engineering a platform API, capture a HAR of the conversation page load and inspect it offline. **Never commit HAR files**: they contain your session cookies and auth tokens (`*.har` is gitignored).

## Architecture

```text
index.js                     entry point: calls run()
src/ChatDump.js              orchestrator: platform detection, remote-first extraction
                             with AbortController deadlines, DOM fallback, formatting, toast
src/ParserFactory.js         exact HTTPS hostname -> parser resolution
src/Parsers/*.js             per-platform ParserModule: parseRemote() (API) + parse() (DOM)
src/ChatGPTApi.js            paginated retrieval, dedupe, active-branch resolution, warnings
src/RemoteUtils.js           apiFetch/apiGet (same-origin, no redirects, abortable), marker, fence
src/Citations.js             genui / cite / 【†】 markers -> Markdown links
src/ConversationProcessor.js item validation, UI-chrome cleanup, heading demotion
src/OutputFormatter.js       Markdown / HTML / TXT documents (scaffolding, preamble)
src/MarkdownRenderer.js      compact MD->HTML renderer for API-sourced turns
src/HTMLCleaner.js           tag/attribute sanitizer for DOM-sourced HTML export
src/I18n.js                  locale tables (10 languages + Italian) and t()
src/UIManager.js             toast UI (loading / export / copied / error states)
bundle.js, build.js, encode.js  reproducible build, --check mode, bookmarklet encoding
src/Utilities.js             filename slug/timestamp
types.js                     JSDoc typedefs (ConversationItem, ParserModule)
```

An export also carries an `ExportInfo` (source, completeness, warnings) that the formatters render as the notice. A turn travels the pipeline as a `ConversationItem`, carrying either a **detached DOM node** (`content`, from DOM parsing) or a **Markdown string** (`markdown`, from API extraction), plus optional `attachments`. Formatters handle both transparently.

## Adding a new platform

Create `src/Parsers/NewPlatformParser.js` exporting a `ParserModule`:

```javascript
import '../../types.js'
import { createConversationItem } from '../ConversationProcessor.js'

/** @type {ParserModule} */
const NewPlatformParser = {
    name: 'newplatform',
    matches: (hostname) => hostname.includes('chat.newplatform.com'),

    // Optional but strongly recommended: extract through the platform's own
    // same-origin API, so virtualized/unloaded turns are not lost. Return null
    // (or throw) to fall back to the DOM parser.
    parseRemote: async () => {
        const data = await (await fetch('/api/conversation/current')).json()
        const items = data.messages.map((m, i) =>
            createConversationItem({
                role: m.role === 'user' ? 'PROMPT' : 'RESPONSE',
                num: Math.floor(i / 2) + 1,
                markdown: m.text, // API path: Markdown string, no DOM node
            }),
        )
        return { title: data.title, items }
    },

    // DOM fallback. content must be a DOM node, NOT an HTML string: strings
    // would need re-parsing through Trusted Types sinks blocked by the
    // platforms' CSP.
    parse: (body) => {
        const conversations = []
        body.querySelectorAll('.conversation-turn-selector').forEach((node, i) => {
            const promptNode = node.querySelector('.prompt-selector')
            const responseNode = node.querySelector('.response-selector')
            if (promptNode) {
                conversations.push(createConversationItem({ role: 'PROMPT', num: i + 1, content: promptNode }))
            }
            if (responseNode) {
                conversations.push(createConversationItem({ role: 'RESPONSE', num: i + 1, content: responseNode }))
            }
        })
        return conversations
    },
}

export default NewPlatformParser
```

Register it in `src/ParserFactory.js` (add the import and append it to the `parsers` array), save an HTML dump of the platform, add a mocked-fetch test for the API path, then run the harness and `npm run build`.

## Contributing

Contributions are welcome: fork, branch, add the feature or fix (with its test), and open a pull request. Platform DOMs and private APIs drift — if an export comes out empty or truncated, an updated HTML dump and/or a HAR-derived description of the API change is the most useful thing you can attach to an issue.

## Changelog

### v1.4.0 (2026-07-04)

**Export engine rewritten API-first (fixes severe information loss):**

- **ChatGPT - API-first extraction.** chatgpt.com virtualizes the message list too (infinite scroll unloads off-screen turns). The parser now reads the session access token from `/api/auth/session` (same-origin, cookie-authenticated) and fetches the full conversation tree from `/backend-api/conversation/{uuid}`. The active branch is linearized from `current_node` (abandoned edit-branches excluded), consecutive assistant nodes (text + tool code chains) are merged into one response as in the UI, `code` messages become fenced blocks, prompt attachments are listed from message metadata, and hidden/system/thought messages are excluded. DOM fallback unchanged.
- **Gemini - API-first extraction.** gemini.google.com lazy-loads the message list (only recent turns are in the DOM until the user scrolls). The parser now calls the same `batchexecute` RPC the app uses (`rpcids=hNvQHb`, structure reverse-engineered from a HAR capture): the `at` token and build label come from `WIZ_global_data`, turn records arrive newest-first and are re-ordered, the continuation cursor is followed across pages, regenerated responses resolve to the draft actually continued (parent-pointer match), and attachment file names are collected from the nested records (listed once, at first occurrence). If pagination stalls and the human-scrolled DOM holds more turns than the API returned, the DOM parser is preferred. DOM fallback unchanged.
- **UX** - the toast now appears immediately in a loading state (spinner + localized label) while the conversation API roundtrip is in flight, and is replaced by the export buttons when ready. A 10s deadline (`Promise.race`) guards against slow/hung APIs: past it, the export falls back to DOM parsing transparently, as it does on any API error.
- **Claude - API-first extraction.** claude.ai virtualizes the message list: only the last ~12 messages exist in the DOM (`data-test-render-count`), so DOM scraping silently dropped every earlier turn of long conversations. The Claude parser now fetches the full conversation from the same-origin `/api/organizations/{org}/chat_conversations/{uuid}` endpoint (auth comes from the session cookies; the org UUID is read from the `lastActiveOrg` cookie with a `/api/organizations` fallback). This yields *all* turns, prompt attachments with their extracted text content, artifact sources (emitted as fenced code blocks), and tool-use markers. Extended-thinking blocks remain excluded by design. If the API is unavailable (endpoint change, logged-out page), the engine falls back to the DOM parser transparently.
- **Claude - DOM fallback upgraded.** Prompt attachments (image thumbnails, document cards) are now exported as an `[Attachments: ...]` line; artifact cards and tool-status chips are preserved as one-line `[Artifact: ...]` / `[Tool: ...]` markers interleaved in document order with the response text; prompts are converted through Turndown (instead of `innerText`) so pasted code keeps its fenced blocks.
- **Pipeline** - `ConversationItem` now supports Markdown-sourced turns (from API extractors) alongside DOM-sourced ones; the HTML export renders Markdown turns through a compact in-tree Markdown renderer (headings, fenced code, lists, GFM tables, blockquotes).
- **Heading scaffolding** - turn-content headings are demoted to start at level 3 (relative hierarchy preserved, fenced code untouched), so LLM-authored `##` sections no longer collide with the `## Human Prompt / LLM Response` turn headers (H1 stays the conversation title).
- **Provenance preamble** - every export opens with a localized line under the title: tool link, creation date in the browser locale, and the original conversation URL.
- **TXT export** - new plain-text output (save + copy buttons alongside MD and HTML): Markdown-ish turn content with plain separators for title and turn headers.

**Internationalization:**

- All UI strings and export labels (turn headers, attachment/artifact/tool markers, error messages) are localized in the 10 most spoken languages (English, Mandarin Chinese, Hindi, Spanish, French, Arabic, Bengali, Portuguese, Russian, Urdu) plus Italian, resolved automatically from the browser language (`navigator.language`) with English fallback. The toast switches to RTL for Arabic and Urdu.

**UI:**

- Toast redesigned: dark glassmorphism card (blur + translucency), system font stack, accent status dot (indigo/green/red), ghost pill buttons with subtle hover, softer entrance animation. Replaces the previous teal-gradient monospace bar.

**Testing / build:**

- New `test/remote-claude.js`, `test/remote-chatgpt.js` and `test/remote-gemini.js`: verify the API extraction paths against a mocked same-origin fetch (turn coverage, attachments, artifact sources, branch linearization, assistant-node merging, thinking/hidden-message exclusion, batchexecute envelope decoding, cursor pagination, chosen-draft selection, MD + HTML outputs).
- `test/e2e-dist.js` now awaits the async `run()` pipeline.
- esbuild targets raised to evergreen browsers (chrome90/firefox88/safari14/edge90): the chat platforms themselves do not run on anything older, and the lighter transpilation buys bundle headroom.
- Bundle size: ~60KB encoded (the i18n tables account for most of the growth: ~13KB pre-encoding, heavier once percent-encoded), below the 62KB bookmarklet limit with ~3KB headroom.

### v1.3.0 (2026-06-10)

**Trusted Types / CSP compatibility:**

- **All Platforms** - The chat platforms enforce Trusted Types via CSP (`require-trusted-types-for 'script'`), which blocks every HTML-from-string injection sink with a "Sink type mismatch violation" error: `innerHTML` setters and `DOMParser.parseFromString` alike. The pipeline no longer re-parses HTML strings at all: parsers hand DOM nodes (from the in-memory body clone) to the processor, Turndown receives nodes directly, the HTML cleaner works on cloned nodes, and the toast UI is built with `createElement`. The end-to-end test simulates Trusted Types enforcement by making both sinks throw.

**Parser Updates (verified against fresh HTML dumps of all three platforms):**

- **ChatGPT Parser** - Rewritten around the current DOM: turns are now iterated via `section[data-turn="user|assistant"]` with separate per-role counters. Fixes wrong/duplicated turn numbering on non-alternating conversations and handles image-generation turns (which carry no `data-message-author-role` at all). Falls back to the legacy `div[data-message-author-role]` selector for older DOMs.
- **Claude Parser** - Responses now extract only the `.standard-markdown` blocks, excluding extended-thinking and tool-use chrome (status buttons, duplicated thinking summaries that previously leaked into every exported response). Falls back to the whole response node when no markdown blocks are present.
- **All Platforms** - Screen-reader-only labels (`.sr-only`, `.cdk-visually-hidden`) and buttons are now stripped centrally during processing. This removes Gemini's "Hai detto" / "Gemini ha detto" labels (the latter used to leak into Markdown as a spurious heading) from both Markdown and HTML outputs.

**Build:**

- Dropped `esbuild-plugin-bookmarklet`: version 1.1.0 has an upstream bug that writes the plain minified JS instead of the URI-encoded bookmarklet. The `javascript:void` prefixing and URI-encoding now live directly in `build.js`, together with a hard size guard (build fails above 62KB).
- Replaced `slugify` (10.7KB), `toastify-js` (6.3KB) and `copy-to-clipboard` (3.3KB) with minimal in-tree implementations. The only runtime dependencies left are `turndown` and `turndown-plugin-gfm`.
- License comments stripped from the bundle (`legalComments: 'none'`); attribution lives in this README.

**Testing:**

- New `jsdom`-based verification harness in `test/`: parser-level checks, full-pipeline Markdown/HTML exports, UI smoke test, and an end-to-end test that decodes and executes the compiled bookmarklet against saved HTML dumps.

### v1.2.0 (2026-01-07)

**Parser Fixes:**

- **Claude Parser** - Fixed critical issue where prompts and responses were not interleaved correctly. Changed to single-query selector to preserve DOM order.
- **Claude Parser** - Updated selectors to use stable `data-testid="user-message"` and `[data-is-streaming] > .font-claude-response` instead of unreliable class-based selectors.
- **ChatGPT Parser** - Fixed content selector: replaced non-existent `.text-token-text-primary` with `.markdown || .whitespace-pre-wrap` fallback.

**Code Block Cleanup:**

- **All Platforms** - Code blocks now properly extract only the code content, removing UI elements (language labels, copy buttons, syntax highlighting spans).
- **ChatGPT** - Removed "Copy code" button text and language labels that appeared before fenced code blocks.
- **Claude** - Removed language label divs (e.g., "bash", "json") that appeared as stray text before code blocks.
- **Gemini** - Removed `.code-block-decoration` headers containing language labels and copy buttons. Added language extraction from decoration span before removal.

**Table UI Cleanup:**

- **Gemini** - Removed "Export to Sheets" button text and other table footer UI elements (`.table-footer`, `.export-sheets-*`, `.hide-from-message-*`).

**Build:**

- Bundle size: ~55KB (compatible with Firefox bookmarklet limits)

### v1.1.0

- Initial release with support for ChatGPT, Gemini, and Claude.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

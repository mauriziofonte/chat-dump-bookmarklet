# ChatDump

The ChatDump bookmarklet is a tool that allows you to export conversations with **ChatGPT**, **Gemini**, and **Claude** as markdown and HTML files. With this bookmarklet, you can capture and save your conversations in a readable format for easy reference, sharing, or archiving.

## Installation

Copy the source code of [the ChatDump bookmarklet](./dist/chatdump.bookmarklet.js) and create a new bookmark in your browser, pasting the code into the URL/location field.

As an alternative, visit the [ChatDump web page](https://www.mauriziofonte.it/blog/post/chatdump-bookmarklet.html) and drag the bookmarklet link to your browser's bookmark toolbar.

> **Heads up!** Always review the source code of the bookmarklet to ensure its integrity and functionality before using it.

## How It Works

Once you click the bookmarklet on a supported chat platform page:

1. ChatDump **detects the platform** you are on.
2. It **clones the page's content in memory** to avoid altering the live page.
3. A **platform-specific parser extracts the conversation turns** (prompts and responses).
4. The **extracted HTML is cleaned** to remove unnecessary elements like buttons and scripts.
5. The cleaned conversation is **formatted into both Markdown and HTML**.
6. A **notification appears**, giving you options to **download the conversation** in either format or **copy the content** directly to your clipboard.

## Building From Source

If you prefer a more hands-on approach, you can clone this repository, install the necessary dependencies, and compile the code on your own machine.

1. **Clone the repository:**

    ```bash
    git clone https://github.com/mauriziofonte/chat-dump-bookmarklet.git
    cd chat-dump-bookmarklet
    ```

2. **Install dependencies:**

    ```bash
    npm install
    ```

3. **Build the project:**

    ```bash
    npm run build
    ```

    This command bundles and minifies the code with `esbuild`, URI-encodes it with the `javascript:void` prefix, and writes the `dist/chatdump.bookmarklet.js` bookmarklet file. The build fails if the encoded output exceeds the 62KB browser bookmarklet limit.

## Development and Debugging

The recommended workflow is to test the parsers offline against saved HTML dumps, using the `jsdom`-based harness in `test/` (installed as a dev dependency).

1. Open a conversation on a supported platform and save the full page as HTML in the project root, named `<platform>-<n>.html` (e.g. `chatgpt-1.html`, `gemini-1.html`, `claude-1.html`). These files are gitignored.
2. Make your code changes in the `src/` directory.
3. Run the verification scripts:

    ```bash
    node test/verify.js      # runs the real parsers against every dump, prints extracted items
    node test/dump-all.js    # runs the full pipeline, writes .md/.html exports to /tmp/chatdump-out/
    node test/ui-smoke.js    # smoke-tests the toast UI and filename generation
    node test/e2e-dist.js    # decodes dist/chatdump.bookmarklet.js and executes it against the dumps
    node test/meta-build.mjs # prints the per-module bundle size breakdown
    ```

4. Rebuild with `npm run build` and re-run `test/e2e-dist.js` to validate the compiled bookmarklet.

For in-browser debugging, decode the bookmarklet and paste it into the developer console of a conversation page:

```bash
node -e "console.log(decodeURI(require('fs').readFileSync('dist/chatdump.bookmarklet.js','utf8')).replace(/^javascript:void /,''))"
```

Any runtime failure is logged to the console with the `[ChatDump Error]` prefix and surfaced in an error toast.

## Contributing

Contributions are welcome! If you want to add support for a new chat platform or fix a bug, please follow these steps.

1. Fork the repository and create a new branch.
2. Add your feature or bug fix.
3. Submit a pull request.

### Adding a New Parser

To add support for a new platform, you need to create a `ParserModule`. This involves creating a new parser file and registering it.

#### 1. Create the Parser File

Create a new file in `src/Parsers/`, for example, `src/Parsers/NewPlatformParser.js`. The file must export an object that conforms to the `ParserModule` interface.

```javascript
// src/Parsers/NewPlatformParser.js
import '../../types.js' // For IDE type-hinting
import { createConversationItem } from '../ConversationProcessor.js'

/** @type {ParserModule} */
const NewPlatformParser = {
    name: 'newplatform',
    matches: (hostname) => hostname.includes('chat.newplatform.com'),
    parse: (body) => {
        const conversations = [];
        // Use querySelectorAll to find the elements containing conversation turns
        body.querySelectorAll('.conversation-turn-selector').forEach((node, i) => {
            const promptNode = node.querySelector('.prompt-selector');
            const responseNode = node.querySelector('.response-selector');

            // content must be a DOM node, NOT an HTML string: strings would need
            // re-parsing through Trusted Types sinks blocked by the platforms' CSP
            if (promptNode) {
                conversations.push(createConversationItem({
                    role: 'PROMPT',
                    num: i + 1,
                    content: promptNode,
                }));
            }
            if (responseNode) {
                conversations.push(createConversationItem({
                    role: 'RESPONSE',
                    num: i + 1,
                    content: responseNode,
                }));
            }
        });
        return conversations;
    }
};

export default NewPlatformParser;
```

#### 2. Register the Parser

Open `src/ParserFactory.js` and add your new parser to the `parsers` array.

```javascript
// src/ParserFactory.js
import ChatGPTParser from './Parsers/ChatGPTParser.js'
import GeminiParser from './Parsers/GeminiParser.js'
import ClaudeParser from './Parsers/ClaudeParser.js'
import NewPlatformParser from './Parsers/NewPlatformParser.js' // <-- Import your new parser

/** @type {ParserModule[]} */
const parsers = [
    ChatGPTParser,
    GeminiParser,
    ClaudeParser,
    NewPlatformParser, // <-- Add it to the array
];

// ... rest of the file
```

After these changes, run `npm run build` and test your new parser using the debugging workflow described above.

## Changelog

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
- Bundle size: ~25KB encoded (was ~55KB), well below the 62KB bookmarklet limit.

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

### License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

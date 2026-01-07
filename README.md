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

    This command will bundle the code as a bookmarklet (via `esbuild-plugin-bookmarklet`) and create the `dist/chatdump.bookmarklet.js` minified bookmarklet file.

## Development and Debugging

Debugging a bookmarklet can be tricky due to its "one-liner" nature. The recommended workflow is a process of trial and error using your browser's developer console.

1. Make your code changes in the `src/` directory.
2. Run the build command to generate the bundled, un-minified file:

    ```bash
    npm run build
    ```

3. Open the generated `dist/chatdump.js` file and copy its entire content.
4. Navigate to a conversation page on a supported platform (like ChatGPT).
5. Open your browser's developer tools (F12 or Ctrl+Shift+I) and go to the **Console** tab.
6. Paste the copied code into the console and press Enter.

This will execute your modified script in the context of the page, allowing you to see any `console.error` messages or use `console.log` for debugging. After confirming your changes work, you can create a new bookmarklet from the minified `dist/chatdump.min.js` file for regular use.

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

            if (promptNode) {
                conversations.push(createConversationItem({
                    role: 'PROMPT',
                    num: i + 1,
                    content: promptNode.innerHTML,
                }));
            }
            if (responseNode) {
                conversations.push(createConversationItem({
                    role: 'RESPONSE',
                    num: i + 1,
                    content: responseNode.innerHTML,
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

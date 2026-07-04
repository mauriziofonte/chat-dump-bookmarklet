import '../types.js'
import { cleanHtml } from './HTMLCleaner.js'
import { renderMarkdown } from './MarkdownRenderer.js'
import { t } from './I18n.js'
import TurndownService from 'turndown'
import { tables } from 'turndown-plugin-gfm'

const REPO_URL = 'https://github.com/mauriziofonte/chat-dump-bookmarklet'

/**
 * Generates a header for a conversation turn, in the browser language.
 * @param {string} role - The role ('PROMPT' or 'RESPONSE').
 * @param {number} num - The turn number.
 * @returns {string} The formatted header string.
 */
function _getConversationHeader(role, num) {
	return role === 'PROMPT' ? t('prompt_header', { n: num }) : t('response_header', { n: num })
}

/**
 * Builds the localized provenance line placed under the document title:
 * tool link, creation date in the browser locale, original conversation URL.
 * @param {'md'|'html'|'txt'} format - The output format.
 * @returns {string} The preamble line, marked up for the format.
 */
function _preamble(format) {
	const locale = (typeof navigator !== 'undefined' && navigator.language) || 'en'
	const date = new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
	const href = window.location.href
	if (format === 'md') {
		return t('preamble', { format: 'Markdown', tool: `[ChatDump](${REPO_URL})`, date, url: `[${href}](${href})` })
	}
	if (format === 'html') {
		return t('preamble', { format: 'HTML', tool: `<a href="${REPO_URL}">ChatDump</a>`, date, url: `<a href="${href}">${href}</a>` })
	}
	return t('preamble', { format: 'TXT', tool: `ChatDump (${REPO_URL})`, date, url: href })
}

/**
 * Creates the Turndown instance shared by the Markdown and TXT exports.
 * @returns {TurndownService}
 */
function _turndown() {
	const ts = new TurndownService({
		hr: '___________',
		headingStyle: 'atx',
		codeBlockStyle: 'fenced',
		bulletListMarker: '-',
	})
	ts.use(tables)
	// Tool-use / artifact markers injected by the parsers: emit verbatim as a
	// blockquote line, bypassing Markdown escaping of the bracket characters
	ts.addRule('chatdumpMarker', {
		filter: (node) => node.nodeName === 'P' && node.getAttribute('data-chatdump-marker') !== null,
		replacement: (content, node) => `\n\n> ${node.textContent.trim()}\n\n`,
	})
	return ts
}

/**
 * Resolves the Markdown-ish content of a single turn. Markdown items (API
 * extraction) are already Markdown source; DOM responses and rich prompts go
 * through Turndown (it accepts DOM nodes and clones them, so c.content is not
 * mutated); plain prompts keep innerText to preserve the text as entered.
 * @param {TurndownService} ts - The Turndown instance.
 * @param {ConversationItem} c - The conversation item.
 * @returns {string} The turn content.
 */
function _itemContent(ts, c) {
	if (typeof c.markdown === 'string') {
		return c.markdown
	}
	if (c.role === 'RESPONSE' || c.richText) {
		return ts.turndown(c.content)
	}
	return c.content.innerText || c.content.textContent
}

/**
 * Formats the attachment list of a turn as a Markdown blockquote line.
 * @param {ConversationItem} item - The conversation item.
 * @returns {string} The attachments line, or an empty string.
 */
function _attachmentsMd(item) {
	if (!item.attachments || !item.attachments.length) {
		return ''
	}
	return `> [${t('attachments')}: ${item.attachments.join(', ')}]\n\n`
}

/**
 * Converts conversations to a Markdown string.
 * @param {ConversationItem[]} conversations - The processed conversation items.
 * @param {string} title - The title of the chat.
 * @returns {string} The complete Markdown document.
 */
export function formatAsMarkdown(conversations, title) {
	const ts = _turndown()

	const body = conversations.reduce((acc, c) => {
		const header = _getConversationHeader(c.role, c.num)
		return `${acc}## ${header}\n\n${_attachmentsMd(c)}${_itemContent(ts, c)}\n\n`
	}, '')

	return `# ${title}\n\n${_preamble('md')}\n\n${body}`
}

/**
 * Converts conversations to an HTML string.
 * @param {ConversationItem[]} conversations - The processed conversation items.
 * @param {string} title - The title of the chat.
 * @returns {string} The complete HTML document string.
 */
export function formatAsHtml(conversations, title) {
	const body = conversations.reduce((acc, c) => {
		const header = _getConversationHeader(c.role, c.num)
		const attachments = c.attachments && c.attachments.length ? `\n<p><em>${t('attachments')}: ${c.attachments.join(', ')}</em></p>` : ''
		const content = typeof c.markdown === 'string' ? renderMarkdown(c.markdown) : cleanHtml(c.content)
		return `${acc}\n<h2>${header}</h2>${attachments}\n${content}`
	}, '')

	return `<h1>${title}</h1>\n<p><em>${_preamble('html')}</em></p>${body}`
}

/**
 * Converts conversations to a plain-text string. Turn content stays in its
 * Markdown-ish form (already the most readable plain representation); the
 * scaffolding uses plain separators instead of Markdown headers.
 * @param {ConversationItem[]} conversations - The processed conversation items.
 * @param {string} title - The title of the chat.
 * @returns {string} The complete plain-text document.
 */
export function formatAsTxt(conversations, title) {
	const ts = _turndown()
	const rule = '-'.repeat(64)

	const body = conversations.reduce((acc, c) => {
		const header = _getConversationHeader(c.role, c.num)
		const attachments = c.attachments && c.attachments.length ? `[${t('attachments')}: ${c.attachments.join(', ')}]\n\n` : ''
		return `${acc}${rule}\n${header}\n${rule}\n\n${attachments}${_itemContent(ts, c)}\n\n`
	}, '')

	return `${title}\n${'='.repeat(Math.min(64, title.length))}\n\n${_preamble('txt')}\n\n${body}`
}

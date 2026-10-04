import '../types.js'
import { cleanHtml } from './HTMLCleaner.js'
import { renderMarkdown } from './MarkdownRenderer.js'
import { t } from './I18n.js'
import { escapeHtml, htmlLink, safeHttpUrl, oneLine } from './Html.js'
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
	// The page URL is attacker-influenced (query, fragment): validate and normalize it
	const href = safeHttpUrl(window.location.href) || 'unknown'
	if (format === 'md') {
		const md = href === 'unknown' ? href : `[${href.replace(/[[\]]/g, '\\$&')}](${href.replace(/[()]/g, encodeURIComponent)})`
		return t('preamble', { format: 'Markdown', tool: `[ChatDump](${REPO_URL})`, date, url: md })
	}
	if (format === 'html') {
		// t() output is escaped around the placeholders: escape the localized text, then splice markup
		return _htmlPreamble({ tool: htmlLink(REPO_URL, 'ChatDump'), date: escapeHtml(date), url: href === 'unknown' ? escapeHtml(href) : htmlLink(href) })
	}
	return t('preamble', { format: 'TXT', tool: `ChatDump (${REPO_URL})`, date, url: href })
}

/**
 * Renders the HTML preamble: the localized template is escaped first, and the
 * pre-escaped link markup is substituted afterwards through unique tokens.
 * @param {{tool: string, date: string, url: string}} parts - Pre-escaped markup parts.
 * @returns {string} The preamble HTML.
 */
function _htmlPreamble(parts) {
	const tokens = { format: 'HTML', tool: '\u0001tool', date: '\u0001date', url: '\u0001url' }
	return escapeHtml(t('preamble', tokens)).replace(/\u0001(tool|date|url)/g, (m, key) => parts[key])
}

/**
 * Builds the completeness notice from the retrieval info. DOM extraction is
 * always labelled possibly incomplete; API retrieval is called verified only
 * when the retrieval itself reported complete.
 * @param {ExportInfo} [info] - How the export was obtained.
 * @returns {{label: string, text: string, items: string[]}|null} The notice, or null when there is nothing to say.
 */
export function buildNotice(info) {
	if (!info) return null
	const label = t('notice_label')
	if (info.source === 'dom') {
		const reason = info.reason ? t('notice_dom_reason', { reason: info.reason }) : ''
		return { label, text: t('notice_dom', { reason }), items: [] }
	}
	const stats = { pages: (info.stats && info.stats.pages) || 1, messages: (info.stats && info.stats.messages) || 0 }
	if (info.warnings && info.warnings.length) {
		return { label, text: t('notice_api_warn', stats), items: info.warnings }
	}
	return info.complete ? { label, text: t('notice_api_ok', stats), items: [] } : null
}

/**
 * Renders the notice for a format; empty string when there is no notice.
 * @param {ExportInfo} [info] - How the export was obtained.
 * @param {'md'|'html'|'txt'} format - The output format.
 * @returns {string} The notice block including trailing blank line(s).
 */
function _noticeBlock(info, format) {
	const notice = buildNotice(info)
	if (!notice) return ''
	if (format === 'html') {
		const list = notice.items.length ? `<ul>${notice.items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` : ''
		return `\n<blockquote><p><strong>${escapeHtml(notice.label)}:</strong> ${escapeHtml(notice.text)}</p>${list}</blockquote>`
	}
	const lines = [oneLine(notice.text), ...notice.items.map((i) => `- ${oneLine(i)}`)]
	if (format === 'md') {
		return `> **${notice.label}:** ${lines.join('\n> ')}\n\n`
	}
	return `[${notice.label}] ${lines.join('\n')}\n\n`
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
	return `> [${t('attachments')}: ${item.attachments.map(oneLine).join(', ')}]\n\n`
}

/**
 * Converts conversations to a Markdown string.
 * @param {ConversationItem[]} conversations - The processed conversation items.
 * @param {string} title - The title of the chat.
 * @param {ExportInfo} [info] - How the export was obtained (completeness notice).
 * @returns {string} The complete Markdown document.
 */
export function formatAsMarkdown(conversations, title, info) {
	const ts = _turndown()

	const body = conversations.reduce((acc, c) => {
		const header = _getConversationHeader(c.role, c.num)
		return `${acc}## ${header}\n\n${_attachmentsMd(c)}${_itemContent(ts, c)}\n\n`
	}, '')

	return `# ${oneLine(title)}\n\n${_preamble('md')}\n\n${_noticeBlock(info, 'md')}${body}`
}

/**
 * Converts conversations to an HTML string.
 * @param {ConversationItem[]} conversations - The processed conversation items.
 * @param {string} title - The title of the chat.
 * @param {ExportInfo} [info] - How the export was obtained (completeness notice).
 * @returns {string} The complete HTML document string.
 */
export function formatAsHtml(conversations, title, info) {
	const body = conversations.reduce((acc, c) => {
		const header = _getConversationHeader(c.role, c.num)
		const attachments = c.attachments && c.attachments.length ? `\n<p><em>${escapeHtml(t('attachments'))}: ${c.attachments.map(escapeHtml).join(', ')}</em></p>` : ''
		const content = typeof c.markdown === 'string' ? renderMarkdown(c.markdown) : cleanHtml(c.content)
		return `${acc}\n<h2>${escapeHtml(header)}</h2>${attachments}\n${content}`
	}, '')

	return `<h1>${escapeHtml(title)}</h1>\n<p><em>${_preamble('html')}</em></p>${_noticeBlock(info, 'html')}${body}`
}

/**
 * Converts conversations to a plain-text string. Turn content stays in its
 * Markdown-ish form (already the most readable plain representation); the
 * scaffolding uses plain separators instead of Markdown headers.
 * @param {ConversationItem[]} conversations - The processed conversation items.
 * @param {string} title - The title of the chat.
 * @param {ExportInfo} [info] - How the export was obtained (completeness notice).
 * @returns {string} The complete plain-text document.
 */
export function formatAsTxt(conversations, title, info) {
	const ts = _turndown()
	const rule = '-'.repeat(64)
	title = oneLine(title)

	const body = conversations.reduce((acc, c) => {
		const header = _getConversationHeader(c.role, c.num)
		const attachments = c.attachments && c.attachments.length ? `[${t('attachments')}: ${c.attachments.map(oneLine).join(', ')}]\n\n` : ''
		return `${acc}${rule}\n${header}\n${rule}\n\n${attachments}${_itemContent(ts, c)}\n\n`
	}, '')

	return `${title}\n${'='.repeat(Math.min(64, title.length))}\n\n${_preamble('txt')}\n\n${_noticeBlock(info, 'txt')}${body}`
}

import '../types.js'
import { cleanHtml } from './HTMLCleaner.js'
import TurndownService from 'turndown'
import { tables } from 'turndown-plugin-gfm'

/**
 * Generates a header for a conversation turn.
 * @param {string} role - The role ('PROMPT' or 'RESPONSE').
 * @param {number} num - The turn number.
 * @returns {string} The formatted header string.
 */
function _getConversationHeader(role, num) {
	return role === 'PROMPT' ? `Human Prompt ${num}` : `LLM Response ${num}`
}

/**
 * Converts conversations to a Markdown string.
 * @param {ConversationItem[]} conversations - The processed conversation items.
 * @param {string} title - The title of the chat.
 * @returns {string} The complete Markdown document.
 */
export function formatAsMarkdown(conversations, title) {
	const ts = new TurndownService({
		hr: '___________',
		headingStyle: 'atx',
		codeBlockStyle: 'fenced',
		bulletListMarker: '-',
	})
	ts.use(tables)

	const body = conversations.reduce((acc, c) => {
		const header = _getConversationHeader(c.role, c.num)
		// For prompts, use innerText to get a clean text representation.
		// For responses, use Turndown to convert the cleaned HTML to Markdown.
		let content
		if (c.role === 'RESPONSE') {
			content = ts.turndown(c.content)
		} else {
			// Keep prompt text as it was entered
			const div = document.createElement('div')
			div.innerHTML = c.content
			content = div.innerText
		}
		return `${acc}## ${header}\n\n${content}\n\n`
	}, '')

	return `# ${title}\n\n${body}`
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
		return `${acc}\n<h2>${header}</h2>\n${cleanHtml(c.content)}`
	}, '')

	return `<h1>${title}</h1>${body}`
}

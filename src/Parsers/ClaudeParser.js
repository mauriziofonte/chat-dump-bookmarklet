import '../../types.js'
import { createConversationItem } from '../ConversationProcessor.js'
import { t } from '../I18n.js'
import { apiGet, marker as _marker, fence as _fence } from '../RemoteUtils.js'

const CONVERSATION_PATH = /\/chat\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

/**
 * Reads the active organization UUID from the claude.ai cookies, if present.
 * @returns {string|null} The organization UUID or null.
 */
function _orgFromCookie() {
	const match = document.cookie.match(/(?:^|;\s*)lastActiveOrg=([0-9a-f-]{36})/i)
	return match ? match[1] : null
}

/**
 * Maps an assistant message's content blocks to Markdown, preserving artifact
 * sources and marking tool invocations. Thinking blocks are intentionally
 * excluded (model chrome, not conversation content).
 * @param {object} message - A chat_messages entry from the conversation API.
 * @returns {string} The Markdown source of the response.
 */
function _assistantMarkdown(message) {
	const blocks = Array.isArray(message.content) ? message.content : []
	const parts = []
	for (const block of blocks) {
		if (block.type === 'text' && block.text) {
			parts.push(block.text.trim())
		} else if (block.type === 'tool_use') {
			const input = block.input || {}
			if (block.name === 'artifacts' && input.command !== 'delete') {
				const title = input.title || input.id || 'artifact'
				parts.push(`> ${_marker(t('artifact'), title)}`)
				if (typeof input.content === 'string' && input.content.trim()) {
					parts.push(_fence(input.content, input.language || ''))
				}
			} else if (block.name !== 'artifacts') {
				const detail = typeof input.query === 'string' ? `${block.name} — ${input.query}` : block.name
				parts.push(`> ${_marker(t('tool'), detail)}`)
			}
		}
		// 'thinking' and 'tool_result' blocks are skipped on purpose
	}
	const markdown = parts.join('\n\n')
	return markdown || (message.text || '').trim()
}

/**
 * Maps a human message to Markdown text plus its attachment list. Text
 * attachments carry their extracted content (otherwise lost from the DOM).
 * @param {object} message - A chat_messages entry from the conversation API.
 * @returns {{markdown: string, attachments: string[]}}
 */
function _humanMarkdown(message) {
	const blocks = Array.isArray(message.content) ? message.content : []
	const texts = blocks.filter((b) => b.type === 'text' && b.text).map((b) => b.text.trim())
	const parts = [texts.length ? texts.join('\n\n') : (message.text || '').trim()]
	const attachments = []
	for (const att of message.attachments || []) {
		if (!att.file_name) continue
		attachments.push(att.file_name)
		if (typeof att.extracted_content === 'string' && att.extracted_content.trim()) {
			parts.push(`> ${_marker(t('attachment'), att.file_name)}`)
			parts.push(_fence(att.extracted_content))
		}
	}
	for (const file of [...(message.files || []), ...(message.files_v2 || [])]) {
		if (file.file_name && !attachments.includes(file.file_name)) {
			attachments.push(file.file_name)
		}
	}
	return { markdown: parts.filter(Boolean).join('\n\n'), attachments }
}

/**
 * Collects attachment file names surrounding a DOM user-message node.
 * Thumbnails are siblings of the message bubble inside the turn container:
 * document cards expose the name in an inner <h3>, image previews in a
 * data-testid attribute shaped like a file name.
 * @param {Element} node - The [data-testid="user-message"] element.
 * @returns {string[]} The attachment file names.
 */
function _domAttachments(node) {
	let container = node
	for (let i = 0; i < 8 && container.parentElement; i++) {
		container = container.parentElement
		if (container.querySelector('[data-testid="file-thumbnail"], [class*="group/thumbnail"]')) {
			break
		}
	}
	const names = []
	container.querySelectorAll('[data-testid="file-thumbnail"] h3').forEach((h3) => {
		const name = h3.textContent.trim()
		if (name && !names.includes(name)) names.push(name)
	})
	container.querySelectorAll('[data-testid]').forEach((el) => {
		const tid = el.getAttribute('data-testid')
		if (/\.[a-z0-9]{2,5}$/i.test(tid) && !names.includes(tid)) {
			names.push(tid)
		}
	})
	return names
}

/**
 * Builds the content container for a DOM response node: keeps the
 * .standard-markdown blocks and interleaves one-line markers for artifact
 * cards and tool-status chips, in document order. Falls back to the whole
 * node when no markdown blocks are present (older DOM).
 * @param {Element} node - The .font-claude-response element.
 * @returns {Element} A detached container with the response content.
 */
function _domResponseContent(node) {
	const doc = node.ownerDocument
	const pieces = node.querySelectorAll('.standard-markdown, [class*="artifact-block-cell"], button[class*="group/status"]')
	if (!pieces.length) {
		return node
	}
	const container = doc.createElement('div')
	const taken = []
	let lastMarker = ''
	const addMarker = (text) => {
		// Hover-preview duplicates the artifact card in the DOM: skip repeats
		if (!text || text === lastMarker) return
		lastMarker = text
		const p = doc.createElement('p')
		// Rendered as a raw "> [...]" blockquote by the Turndown rule in
		// OutputFormatter (avoids Markdown escaping of the marker brackets)
		p.setAttribute('data-chatdump-marker', '')
		p.textContent = text
		container.appendChild(p)
	}
	pieces.forEach((el) => {
		if (taken.some((parent) => parent.contains(el))) {
			return
		}
		taken.push(el)
		if (el.classList.contains('standard-markdown')) {
			container.appendChild(el)
			lastMarker = ''
		} else if (el.tagName === 'BUTTON') {
			const label = el.querySelector('[class*="truncate"]') || el
			addMarker(_marker(t('tool'), label.textContent || ''))
		} else {
			const title = el.querySelector('[class*="flex-col"]')
			const text = ((title || el).textContent || '').replace(/\s+/g, ' ').trim()
			if (text) {
				addMarker(_marker(t('artifact'), text))
			}
		}
	})
	return container
}

/** @type {ParserModule} */
const ClaudeParser = {
	name: 'claude',
	matches: (hostname) => hostname.includes('claude.ai'),

	/**
	 * API-based extraction. claude.ai virtualizes the message list (only the
	 * last ~12 messages exist in the DOM), so a complete export is only
	 * possible through the same-origin conversation API. Returns null when the
	 * conversation UUID or the API is unavailable (test harnesses, logged-out
	 * pages, endpoint changes), letting ChatDump fall back to DOM parsing.
	 * @returns {Promise<RemoteConversation|null>}
	 */
	parseRemote: async () => {
		if (typeof fetch !== 'function') {
			return null
		}
		const pathMatch = window.location.pathname.match(CONVERSATION_PATH)
		if (!pathMatch) {
			return null
		}
		const conversationId = pathMatch[1]

		const orgIds = []
		const cookieOrg = _orgFromCookie()
		if (cookieOrg) {
			orgIds.push(cookieOrg)
		}
		try {
			const orgs = await apiGet('/api/organizations')
			for (const org of Array.isArray(orgs) ? orgs : []) {
				if (org.uuid && !orgIds.includes(org.uuid)) {
					orgIds.push(org.uuid)
				}
			}
		} catch (e) {
			// cookie-derived org may still work
		}

		let data = null
		for (const orgId of orgIds) {
			try {
				data = await apiGet(
					`/api/organizations/${orgId}/chat_conversations/${conversationId}?tree=True&rendering_mode=messages&render_all_tools=true`,
				)
				break
			} catch (e) {
				// wrong org for this conversation: try the next one
			}
		}
		if (!data || !Array.isArray(data.chat_messages) || !data.chat_messages.length) {
			return null
		}

		const items = []
		let promptNum = 0
		let responseNum = 0
		for (const message of data.chat_messages) {
			if (message.sender === 'human') {
				const human = _humanMarkdown(message)
				items.push(createConversationItem({ role: 'PROMPT', num: ++promptNum, markdown: human.markdown, attachments: human.attachments }))
			} else if (message.sender === 'assistant') {
				items.push(createConversationItem({ role: 'RESPONSE', num: ++responseNum, markdown: _assistantMarkdown(message) }))
			}
		}
		return { title: data.name || document.title, items }
	},

	parse: (body) => {
		const conversations = []

		// Select both user messages and Claude responses in a single query to preserve DOM order
		const selector = '[data-testid="user-message"], [data-is-streaming] > .font-claude-response'
		let promptNum = 0
		let responseNum = 0

		body.querySelectorAll(selector).forEach((n) => {
			if (n.getAttribute('data-testid') === 'user-message') {
				conversations.push(
					createConversationItem({
						role: 'PROMPT',
						num: ++promptNum,
						content: n,
						// Claude prompts render pasted code as <pre><code>: convert
						// through Turndown so fences survive, instead of innerText
						richText: true,
						attachments: _domAttachments(n),
					}),
				)
			} else {
				conversations.push(
					createConversationItem({
						role: 'RESPONSE',
						num: ++responseNum,
						content: _domResponseContent(n),
					}),
				)
			}
		})

		return conversations
	},
}

export default ClaudeParser

import '../../types.js'
import { createConversationItem } from '../ConversationProcessor.js'
import { t } from '../I18n.js'
import { apiGet, marker, fence } from '../RemoteUtils.js'

const CONVERSATION_PATH = /\/c\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

/**
 * Linearizes the conversation tree returned by the backend API: walks from
 * current_node up through the parents (the active branch), then reverses.
 * @param {object} data - The /backend-api/conversation/{id} payload.
 * @returns {object[]} The messages of the active branch, in chat order.
 */
function _activeBranch(data) {
	const chain = []
	let nodeId = data.current_node
	let guard = 0
	while (nodeId && guard++ < 10000) {
		const node = data.mapping && data.mapping[nodeId]
		if (!node) break
		if (node.message) {
			chain.push(node.message)
		}
		nodeId = node.parent
	}
	return chain.reverse()
}

/**
 * Converts a single message's content to Markdown. Returns an empty string
 * for content that must not be exported (thoughts, hidden context).
 * @param {object} message - A mapping-node message.
 * @returns {string} The Markdown for the message.
 */
function _messageMarkdown(message) {
	const content = message.content || {}
	if (content.content_type === 'text') {
		return (content.parts || [])
			.filter((p) => typeof p === 'string')
			.join('\n\n')
			.trim()
	}
	if (content.content_type === 'multimodal_text') {
		return (content.parts || [])
			.map((p) => {
				if (typeof p === 'string') return p.trim()
				if (p && p.content_type === 'image_asset_pointer') return `> ${marker(t('attachment'), 'image')}`
				return ''
			})
			.filter(Boolean)
			.join('\n\n')
	}
	if (content.content_type === 'code' && typeof content.text === 'string' && content.text.trim()) {
		const lang = content.language && content.language !== 'unknown' ? content.language : ''
		return fence(content.text, lang)
	}
	// thoughts, reasoning_recap, user_editable_context, execution outputs: skipped
	return ''
}

/**
 * Collects attachment names declared in a message's metadata.
 * @param {object} message - A mapping-node message.
 * @returns {string[]} The attachment file names.
 */
function _messageAttachments(message) {
	const attachments = (message.metadata && message.metadata.attachments) || []
	return attachments.map((a) => a.name).filter(Boolean)
}

/** @type {ParserModule} */
const ChatGPTParser = {
	name: 'chatgpt',
	matches: (hostname) => hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com'),

	/**
	 * API-based extraction. chatgpt.com virtualizes the message list (infinite
	 * scroll unloads off-screen turns), so a complete export needs the backend
	 * API: the session access token comes from /api/auth/session (same-origin,
	 * cookie-authenticated), the conversation tree from
	 * /backend-api/conversation/{uuid}. Returns null when the token or the
	 * conversation is unavailable, letting ChatDump fall back to DOM parsing.
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
		const session = await apiGet('/api/auth/session')
		if (!session || !session.accessToken) {
			return null
		}
		const data = await apiGet(`/backend-api/conversation/${pathMatch[1]}`, { authorization: `Bearer ${session.accessToken}` })
		if (!data || !data.mapping || !data.current_node) {
			return null
		}

		const items = []
		let promptNum = 0
		let responseNum = 0
		// Assistant turns span several mapping nodes (text + tool code chains):
		// merge consecutive assistant messages into one RESPONSE, as in the UI
		let responseParts = []
		const flushResponse = () => {
			if (responseParts.length) {
				items.push(createConversationItem({ role: 'RESPONSE', num: ++responseNum, markdown: responseParts.join('\n\n') }))
				responseParts = []
			}
		}

		for (const message of _activeBranch(data)) {
			const role = message.author && message.author.role
			if (message.metadata && message.metadata.is_visually_hidden_from_conversation) {
				continue
			}
			if (role === 'user') {
				flushResponse()
				const markdown = _messageMarkdown(message)
				const attachments = _messageAttachments(message)
				if (markdown || attachments.length) {
					items.push(createConversationItem({ role: 'PROMPT', num: ++promptNum, markdown, attachments }))
				}
			} else if (role === 'assistant') {
				const markdown = _messageMarkdown(message)
				if (markdown) {
					responseParts.push(markdown)
				}
			}
			// system / tool messages: skipped
		}
		flushResponse()

		if (!items.length) {
			return null
		}
		return { title: data.title || document.title, items }
	},

	parse: (body) => {
		const conversations = []
		let promptNum = 0
		let responseNum = 0

		// Modern DOM: each turn is a <section data-turn="user|assistant">.
		// Image-generation turns carry no data-message-author-role at all, so iterating
		// turns (not message divs) keeps the numbering consistent. Fallback to the
		// legacy per-message selector for older DOMs.
		let turns = body.querySelectorAll('[data-turn]')
		if (!turns.length) turns = body.querySelectorAll('div[data-message-author-role]')

		turns.forEach((n) => {
			const role = (n.getAttribute('data-turn') || n.getAttribute('data-message-author-role')) === 'user' ? 'PROMPT' : 'RESPONSE'
			// .markdown for assistant responses, .whitespace-pre-wrap for user prompts
			const contentNode = n.querySelector('.markdown') || n.querySelector('.whitespace-pre-wrap')
			if (!contentNode) return // image-only turn: nothing exportable

			conversations.push(
				createConversationItem({
					role,
					num: role === 'PROMPT' ? ++promptNum : ++responseNum,
					content: contentNode,
				}),
			)
		})
		return conversations
	},
}

export default ChatGPTParser

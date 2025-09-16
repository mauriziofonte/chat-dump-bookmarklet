import '../../types.js'
import { createConversationItem } from '../ConversationProcessor.js'

/** @type {ParserModule} */
const ChatGPTParser = {
	name: 'chatgpt',
	matches: (hostname) => hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com'),
	parse: (body) => {
		const conversations = []
		body.querySelectorAll('div[data-message-author-role]').forEach((n, i) => {
			const role = n.getAttribute('data-message-author-role') === 'user' ? 'PROMPT' : 'RESPONSE'
			const contentNode = n.querySelector('.text-token-text-primary, .markdown') // Adapt to potential class changes
			if (!contentNode) return

			conversations.push(
				createConversationItem({
					role,
					num: Math.trunc(i / 2) + 1,
					content: contentNode.innerHTML,
				}),
			)
		})
		return conversations
	},
}

export default ChatGPTParser

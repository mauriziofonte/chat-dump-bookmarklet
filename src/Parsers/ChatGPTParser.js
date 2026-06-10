import '../../types.js'
import { createConversationItem } from '../ConversationProcessor.js'

/** @type {ParserModule} */
const ChatGPTParser = {
	name: 'chatgpt',
	matches: (hostname) => hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com'),
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

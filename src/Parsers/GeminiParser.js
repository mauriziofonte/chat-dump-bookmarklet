import '../../types.js'
import { createConversationItem } from '../ConversationProcessor.js'

/** @type {ParserModule} */
const GeminiParser = {
	name: 'gemini',
	matches: (hostname) => hostname.includes('gemini.google.com'),
	parse: (body) => {
		const conversations = []
		body.querySelectorAll('div.conversation-container').forEach((n, i) => {
			const query = n.querySelector('div.query-content')
			const response = n.querySelector('div.response-content')
			if (!query || !response) return

			conversations.push(
				createConversationItem({
					role: 'PROMPT',
					num: i + 1,
					content: query.innerHTML,
				}),
			)
			conversations.push(
				createConversationItem({
					role: 'RESPONSE',
					num: i + 1,
					content: response.innerHTML,
				}),
			)
		})
		return conversations
	},
}

export default GeminiParser

import '../../types.js'
import { createConversationItem } from '../ConversationProcessor.js'

/** @type {ParserModule} */
const ClaudeParser = {
	name: 'claude',
	matches: (hostname) => hostname.includes('claude.ai'),
	parse: (body) => {
		const conversations = []

		// Select both user messages and Claude responses in a single query to preserve DOM order
		const selector = '[data-testid="user-message"], [data-is-streaming] > .font-claude-response'
		let promptNum = 0
		let responseNum = 0

		body.querySelectorAll(selector).forEach((n) => {
			const isUserMessage = n.hasAttribute('data-testid') && n.getAttribute('data-testid') === 'user-message'

			if (isUserMessage) {
				promptNum++
				conversations.push(
					createConversationItem({
						role: 'PROMPT',
						num: promptNum,
						content: n.innerHTML,
					}),
				)
			} else {
				responseNum++
				conversations.push(
					createConversationItem({
						role: 'RESPONSE',
						num: responseNum,
						content: n.innerHTML,
					}),
				)
			}
		})

		return conversations
	},
}

export default ClaudeParser

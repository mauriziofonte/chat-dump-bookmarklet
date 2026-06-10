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
			if (n.getAttribute('data-testid') === 'user-message') {
				conversations.push(
					createConversationItem({
						role: 'PROMPT',
						num: ++promptNum,
						content: n,
					}),
				)
			} else {
				// A response interleaves .standard-markdown blocks with thinking/tool-use
				// panels (status buttons, sr-only labels). Keep only the markdown blocks
				// (moved into a fresh container); fall back to the whole node when none
				// are present (older DOM).
				const blocks = n.querySelectorAll('.standard-markdown')
				let content = n
				if (blocks.length) {
					content = n.ownerDocument.createElement('div')
					blocks.forEach((b) => content.appendChild(b))
				}
				conversations.push(
					createConversationItem({
						role: 'RESPONSE',
						num: ++responseNum,
						content,
					}),
				)
			}
		})

		return conversations
	},
}

export default ClaudeParser

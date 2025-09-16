import '../../types.js'
import { createConversationItem } from '../ConversationProcessor.js'

/** @type {ParserModule} */
const ClaudeParser = {
	name: 'claude',
	matches: (hostname) => hostname.includes('claude.ai'),
	parse: (body) => {
		const conversations = []
		// Claude's structure is turn-based, each in a group.
		body.querySelectorAll('div.group.relative').forEach((n, i) => {
			const userMsg = n.querySelector('div.font-user-message')
			const claudeMsg = n.querySelector('div.font-claude-response')
			if (!userMsg && !claudeMsg) return

			const role = userMsg ? 'PROMPT' : 'RESPONSE'
			const contentNode = userMsg || claudeMsg

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

export default ClaudeParser

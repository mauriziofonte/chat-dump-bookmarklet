import '../types.js'

/**
 * Factory function to create and validate a conversation item.
 * This ensures all items pushed by parsers have the correct shape.
 * @param {{role: string, num: number, content: string}} itemData - The raw item data.
 * @returns {ConversationItem} The validated conversation item.
 * @throws {Error} if validation fails.
 */
export function createConversationItem(itemData) {
	if (!itemData.role || (itemData.role !== 'PROMPT' && itemData.role !== 'RESPONSE')) {
		throw new Error(`Invalid role: "${itemData.role}". Must be "PROMPT" or "RESPONSE".`)
	}
	if (typeof itemData.num !== 'number' || itemData.num < 1) {
		throw new Error(`Invalid turn number: "${itemData.num}". Must be a positive integer.`)
	}
	if (typeof itemData.content !== 'string') {
		throw new Error('Invalid content type. Content must be a string.')
	}
	return { role: itemData.role, num: itemData.num, content: itemData.content }
}

/**
 * Processes an array of conversation items by cleaning and formatting their content.
 * @param {ConversationItem[]} conversations - The array of conversation items to process.
 * @returns {ConversationItem[]} The processed array of conversation items.
 */
export function processConversations(conversations) {
	return conversations.map((c) => {
		const div = document.createElement('div')
		div.innerHTML = c.content

		// Format code blocks for better cleaning
		div.querySelectorAll('pre > code').forEach((codeEl) => {
			const pre = codeEl.parentElement
			if (pre) {
				pre.innerHTML = codeEl.outerHTML
			}
		})

		// Ensure paragraphs have trailing newlines for markdown conversion
		div.querySelectorAll('p').forEach((p) => {
			p.innerHTML = p.innerHTML.trim() + '\n'
		})

		// Inject into conversation item
		c.content = div.innerHTML

		return c
	})
}

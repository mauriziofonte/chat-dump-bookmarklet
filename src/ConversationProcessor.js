import '../types.js'

/**
 * Factory function to create and validate a conversation item.
 * This ensures all items pushed by parsers have the correct shape.
 * @param {{role: string, num: number, content: Element}} itemData - The raw item data.
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
	if (!itemData.content || typeof itemData.content.querySelectorAll !== 'function') {
		throw new Error('Invalid content type. Content must be a DOM element.')
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
		// Content is a detached DOM node (cloned from the page body): mutate it in place
		const div = c.content

		// Remove UI chrome shared across platforms: screen-reader labels ("Hai detto",
		// "Gemini ha detto", thinking summaries), buttons, and Gemini's table UI elements
		div.querySelectorAll(
			'.sr-only, .cdk-visually-hidden, button, .table-footer, [class*="export-sheets"], [class*="hide-from-message"]',
		).forEach((el) => {
			el.remove()
		})

		// For Gemini: extract language from code-block-decoration BEFORE removing it
		// Structure: .code-block-decoration > span (contains language like "Bash")
		const langMap = new Map()
		div.querySelectorAll('.code-block-decoration, [class*="code-block-decoration"]').forEach((decoration) => {
			const langSpan = decoration.querySelector('span')
			if (langSpan) {
				const langText = langSpan.textContent?.trim().toLowerCase() || ''
				// Find the associated pre element (sibling or in sibling container)
				const container = decoration.parentElement
				const pre = container?.querySelector('pre')
				if (pre && langText) {
					langMap.set(pre, langText)
				}
			}
			decoration.remove()
		})

		// Remove UI elements from code blocks (language labels, copy buttons, etc.)
		// ChatGPT wraps code in: <pre><div>...<code class="language-xxx">...</code></div></pre>
		// Claude has: <div>lang</div><div><pre>...</pre></div> with label as sibling
		// We need to extract just the <code> element and put it directly in <pre>
		div.querySelectorAll('pre').forEach((pre) => {
			const codeEl = pre.querySelector('code')
			if (codeEl) {
				// Get clean text content, stripping any nested spans from syntax highlighting
				const codeText = codeEl.textContent || ''
				// Extract language: first try class, then Gemini's langMap
				const langMatch = codeEl.className.match(/language-(\w+)/)
				let lang = langMatch ? langMatch[1] : ''
				if (!lang && langMap.has(pre)) {
					lang = langMap.get(pre)
				}

				// Remove preceding sibling divs that contain only the language label
				// Walk up to 3 parent levels to find siblings (handles nested structures)
				let parent = pre.parentElement
				for (let level = 0; level < 3 && parent; level++) {
					let sibling = parent.previousElementSibling
					while (sibling) {
						const prevSibling = sibling.previousElementSibling
						const text = sibling.textContent?.trim() || ''
						// Remove if it's a short text-only element (language label)
						// Check: DIV with short text, no complex children (only spans allowed)
						if (sibling.tagName === 'DIV' && text.length <= 30 && !sibling.querySelector('pre, code, p, ul, ol, table')) {
							sibling.remove()
						}
						sibling = prevSibling
					}
					parent = parent.parentElement
				}

				// Create clean code element with just the text and language class
				const cleanCode = pre.ownerDocument.createElement('code')
				if (lang) {
					cleanCode.className = `language-${lang}`
				}
				cleanCode.textContent = codeText
				// Replace entire pre content with clean code element
				pre.textContent = ''
				pre.appendChild(cleanCode)
			}
		})

		// Ensure paragraphs have trailing newlines for markdown conversion
		div.querySelectorAll('p').forEach((p) => {
			p.appendChild(p.ownerDocument.createTextNode('\n'))
		})

		return c
	})
}

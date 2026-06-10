const ALLOWED_TAGS = [
	'p',
	'div',
	'span',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'pre',
	'code',
	'ul',
	'ol',
	'li',
	'strong',
	'em',
	'table',
	'thead',
	'tbody',
	'tr',
	'th',
	'td',
]

/**
 * Recursively removes all HTML comments from a node.
 * @param {Node} node - The root node to clean.
 */
function _removeComments(node) {
	const walker = document.createTreeWalker(node, NodeFilter.SHOW_COMMENT, null)
	const comments = []
	let current
	while ((current = walker.nextNode())) {
		comments.push(current)
	}
	comments.forEach((comment) => comment.remove())
}

/**
 * Cleans and sanitizes a DOM node, returning the resulting HTML string.
 * The input node is cloned, so the original is not mutated.
 * @param {Element} input - The DOM element whose content must be cleaned.
 * @returns {string} The cleaned HTML string.
 */
export function cleanHtml(input) {
	const node = input.cloneNode(true)

	_removeComments(node)

	// Remove non-essential and accessibility-only elements
	node.querySelectorAll(
		'script, style, img, video, audio, button, input, textarea, select, iframe, noscript, svg, canvas, math, .sr-only, [aria-label], [role="img"], [role="button"], [role="textbox"], [role="presentation"]',
	).forEach((e) => e.remove())

	// Process all remaining elements
	node.querySelectorAll('*').forEach((element) => {
		// Remove empty elements
		if (!element.textContent?.trim() && element.children.length === 0) {
			element.remove()
			return // Continue to next element
		}

		// Remove all attributes
		while (element.attributes.length > 0) {
			element.removeAttribute(element.attributes[0].name)
		}

		// Convert non-essential tags to a div to preserve content.
		// Children are moved (not re-parsed via innerHTML): this avoids a Trusted
		// Types sink and keeps descendants in the NodeList so they get processed too.
		if (!ALLOWED_TAGS.includes(element.tagName.toLowerCase())) {
			const div = element.ownerDocument.createElement('div')
			while (element.firstChild) {
				div.appendChild(element.firstChild)
			}
			element.parentNode?.replaceChild(div, element)
		}
	})

	return node.innerHTML
}

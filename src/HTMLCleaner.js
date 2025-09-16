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
 * Cleans and sanitizes an HTML node or string.
 * @param {string|Node} htmlInput - The HTML content to clean.
 * @returns {string} The cleaned HTML string.
 */
export function cleanHtml(htmlInput) {
	let node
	let returnInnerHTML = false

	if (typeof htmlInput === 'string') {
		node = document.createElement('div')
		node.innerHTML = htmlInput
		returnInnerHTML = true
	} else {
		node = htmlInput
	}

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

		// Convert non-essential tags to a div to preserve content
		if (!ALLOWED_TAGS.includes(element.tagName.toLowerCase())) {
			const div = document.createElement('div')
			div.innerHTML = element.innerHTML
			element.parentNode?.replaceChild(div, element)
		}
	})

	return returnInnerHTML ? node.innerHTML : node.outerHTML
}

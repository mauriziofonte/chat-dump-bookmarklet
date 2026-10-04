/**
 * HTML escaping and URL validation helpers for generated HTML. Every value
 * that is not produced by a trusted renderer must pass through these before
 * it is concatenated into markup.
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/**
 * Escapes text for both HTML text and quoted attribute contexts.
 * @param {any} value - The raw value (coerced to a string).
 * @returns {string} The escaped text.
 */
export function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch])
}

/**
 * Validates a URL for use in a generated link: only absolute http(s) URLs
 * are accepted, and the returned value is the normalized form.
 * @param {string} url - The candidate URL.
 * @returns {string|null} The normalized URL, or null when it is not allowed.
 */
export function safeHttpUrl(url) {
	try {
		const parsed = new URL(String(url))
		return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null
	} catch (e) {
		return null
	}
}

/**
 * Builds an anchor element string with an escaped label and a validated,
 * escaped href. Unsafe URLs produce the escaped label alone.
 * @param {string} url - The link target.
 * @param {string} [label] - The link text; defaults to the URL.
 * @returns {string} The HTML for the link.
 */
export function htmlLink(url, label) {
	const href = safeHttpUrl(url)
	const text = escapeHtml(label === undefined ? url : label)
	return href ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${text}</a>` : text
}

/**
 * Collapses control characters and line breaks so a value stays on one line
 * in Markdown and TXT scaffolding (titles, attachment names).
 * @param {any} value - The raw value.
 * @returns {string} The single-line text.
 */
export function oneLine(value) {
	return String(value)
		.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ')
		.trim()
}

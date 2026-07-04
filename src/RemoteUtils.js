/**
 * Shared helpers for the remote (API-based) extractors.
 */

/**
 * Fetches a same-origin API endpoint and returns the parsed JSON.
 * @param {string} path - The API path.
 * @param {Object<string, string>} [headers] - Extra request headers.
 * @returns {Promise<any>} The parsed JSON body.
 * @throws {Error} on network failure or non-2xx status.
 */
export async function apiGet(path, headers) {
	const response = await fetch(path, { headers: Object.assign({ accept: 'application/json' }, headers || {}) })
	if (!response.ok) {
		throw new Error(`API ${path} returned ${response.status}`)
	}
	return response.json()
}

/**
 * Formats the one-line marker used for tool-use / artifact / attachment
 * placeholders in Markdown output.
 * @param {string} label - The translated label ("Tool", "Artifact", ...).
 * @param {string} text - The marker text.
 * @returns {string} The marker, without blockquote prefix.
 */
export function marker(label, text) {
	return `[${label}: ${text.replace(/\s+/g, ' ').trim()}]`
}

/**
 * Wraps raw text in a fenced code block, widening the fence when the text
 * itself contains triple backticks.
 * @param {string} text - The code/text to wrap.
 * @param {string} [lang] - Optional language hint.
 * @returns {string} The fenced block.
 */
export function fence(text, lang = '') {
	const marks = text.includes('```') ? '````' : '```'
	return `${marks}${lang}\n${text}\n${marks}`
}

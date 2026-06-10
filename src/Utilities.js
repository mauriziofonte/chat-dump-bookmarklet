/**
 * Slugifies a string for use in a filename: strips diacritics, lowercases,
 * collapses non-alphanumerics to single dashes.
 * @param {string} str - The string to slugify.
 * @returns {string} The slugified string.
 */
function slugify(str) {
	return str
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80)
}

/**
 * Generates a standardized filename.
 * Format: <platform>-<YYYYMMDD-HHMM>-<slugified-title>.
 * @param {string} platform - The name of the chat platform (e.g., 'chatgpt').
 * @param {string} title - The document title to be slugified.
 * @returns {string} The generated filename base.
 */
export function generateFilename(platform, title) {
	const now = new Date()
	const pad = (n) => String(n).padStart(2, '0')
	const dateTime = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
	return `${platform}-${dateTime}-${slugify(title) || 'conversation'}`
}

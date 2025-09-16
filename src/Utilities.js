import slugify from 'slugify'

/**
 * Generates a standardized filename.
 * Format: <platform>-<YYYYMMDD-HHMM>-<slugified-title>.
 * @param {string} platform - The name of the chat platform (e.g., 'chatgpt').
 * @param {string} title - The document title to be slugified.
 * @returns {string} The generated filename base.
 */
export function generateFilename(platform, title) {
	const now = new Date()
	const dateStr = now
		.toLocaleDateString('en-CA', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		})
		.replace(/-/g, '')
	const timeStr = now
		.toLocaleTimeString('en-GB', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
		})
		.replace(':', '')
	const dateTime = `${dateStr}-${timeStr}`
	return `${platform}-${dateTime}-${slugify(title) || 'conversation'}`
}

/**
 * Escapes a string for safe insertion into an HTML attribute.
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string.
 */
export function escapeHTML(str) {
	return str.replace(/"/g, '&quot;')
}

/**
 * Shared helpers for the remote (API-based) extractors.
 */

/** Per-request deadline; the request is cancelled (not just ignored) when it passes. */
export const REQUEST_TIMEOUT_MS = 15000

/**
 * Fetches a same-origin API path with explicit safety checks: the path must be
 * origin-relative, redirects are rejected (a redirect could carry the
 * Authorization header to another location), the final URL must stay on the
 * page origin, and the request is cancelled through AbortController when the
 * per-request deadline or the caller's signal fires.
 * @param {string} path - Origin-relative path (starts with a single "/").
 * @param {RequestInit} [init] - Extra fetch options (method, headers, body).
 * @param {{signal?: AbortSignal, timeoutMs?: number}} [options] - Cancellation options.
 * @returns {Promise<Response>} The successful response.
 * @throws {Error} on invalid path, redirect, foreign origin, timeout, network failure or non-2xx status.
 */
export async function apiFetch(path, init, options) {
	const signal = options && options.signal
	const timeoutMs = (options && options.timeoutMs) || REQUEST_TIMEOUT_MS
	if (typeof path !== 'string' || path.charAt(0) !== '/' || path.charAt(1) === '/' || path.includes('\\')) {
		throw new Error(`Refusing non-relative API path: ${path}`)
	}
	const controller = new AbortController()
	let timedOut = false
	const timer = setTimeout(() => {
		timedOut = true
		controller.abort()
	}, timeoutMs)
	const onAbort = () => controller.abort()
	if (signal) {
		if (signal.aborted) {
			controller.abort()
		} else {
			signal.addEventListener('abort', onAbort)
		}
	}
	try {
		const response = await fetch(path, Object.assign({ credentials: 'same-origin', redirect: 'error' }, init, { signal: controller.signal }))
		if (response.redirected || (response.url && new URL(response.url, window.location.href).origin !== window.location.origin)) {
			throw new Error(`API ${path} redirected or left the page origin`)
		}
		if (!response.ok) {
			throw new Error(`API ${path} returned ${response.status}`)
		}
		return response
	} catch (error) {
		if (timedOut) {
			throw new Error(`API ${path} timed out after ${timeoutMs} ms`)
		}
		throw error
	} finally {
		clearTimeout(timer)
		if (signal) signal.removeEventListener('abort', onAbort)
	}
}

/**
 * Fetches a same-origin API endpoint and returns the parsed JSON.
 * @param {string} path - The API path.
 * @param {Object<string, string>} [headers] - Extra request headers.
 * @param {{signal?: AbortSignal, timeoutMs?: number}} [options] - Cancellation options.
 * @returns {Promise<any>} The parsed JSON body.
 * @throws {Error} see apiFetch.
 */
export async function apiGet(path, headers, options) {
	const response = await apiFetch(path, { headers: Object.assign({ accept: 'application/json' }, headers || {}) }, options)
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

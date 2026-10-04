/**
 * Shared test helpers: installs jsdom browser globals (the sources rely on
 * window/document/navigator) and builds a mock same-origin fetch.
 */
import { JSDOM } from 'jsdom'

/**
 * Installs jsdom globals for the given page URL and returns the JSDOM.
 * @param {string} url - The page URL.
 * @returns {JSDOM}
 */
export function installDom(url) {
	const dom = new JSDOM('<body></body>', { url })
	global.window = dom.window
	global.document = dom.window.document
	global.DOMParser = dom.window.DOMParser
	global.NodeFilter = dom.window.NodeFilter
	Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
	return dom
}

/**
 * Installs a mock global fetch serving JSON from a route table. Records every
 * request in `calls`. A route value may be a function (init) => body|{status}.
 * @param {Object<string, any>} routes - Path (with query) to response body.
 * @returns {{path: string, init: object}[]} The recorded calls.
 */
export function mockFetch(routes) {
	const calls = []
	global.fetch = async (path, init = {}) => {
		calls.push({ path, init })
		let body = routes[path]
		if (typeof body === 'function') body = body(init)
		if (body === undefined) return { ok: false, status: 404, redirected: false, url: path }
		if (body && body.__status) return { ok: false, status: body.__status, redirected: false, url: path }
		return { ok: true, status: 200, redirected: false, url: path, json: async () => body }
	}
	return calls
}

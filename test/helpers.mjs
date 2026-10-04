/**
 * Shared test helpers: installs jsdom browser globals (the sources rely on
 * window/document/navigator) and builds a mock same-origin fetch.
 */
import { JSDOM } from 'jsdom'
import { mock } from 'node:test'

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

import { readFileSync } from 'node:fs'

export const CONV_ID = 'c0ffee00-0000-4000-8000-00000000abcd'

/** Loads the synthetic paginated ChatGPT payload (deep copy per call). */
export function loadPagedFixture() {
	return JSON.parse(readFileSync(new URL('./fixtures/chatgpt-paged-synthetic.json', import.meta.url), 'utf8'))
}

/**
 * Splits a paged payload into pages (newest first) linked by start_cursor.
 * @param {object} full - The full payload.
 * @param {number[]} sizes - Messages per page, oldest page first.
 * @returns {object[]} Pages newest first.
 */
export function splitPages(full, sizes) {
	const pages = []
	let at = 0
	sizes.forEach((size, i) => {
		const messages = full.messages.slice(at, at + size)
		at += size
		const last = i === sizes.length - 1
		pages.unshift({
			...(last ? full : { title: full.title }),
			messages,
			page_info: { start_cursor: `cursor-${i}`, end_cursor: `end-${i}`, has_previous_page: i > 0, has_next_page: !last },
		})
	})
	return pages
}

/**
 * Routes for the paged ChatGPT endpoint: first request has no `before`, later
 * ones carry the cursor of the page they follow.
 * @param {object[]} pages - Pages newest first.
 * @returns {Object<string, any>} Route table for mockFetch.
 */
export function pagedRoutes(pages) {
	const base = `/backend-api/conversations/${CONV_ID}?include_has_versions=true&num_turns=100`
	const routes = { '/api/auth/session': { accessToken: 'tok-123' }, [base]: pages[0] }
	pages.slice(0, -1).forEach((page, i) => {
		routes[`${base}&before=${encodeURIComponent(page.page_info.start_cursor)}`] = pages[i + 1]
	})
	return routes
}

/**
 * Runs the whole bookmarklet pipeline (run()) in a fresh jsdom page and returns
 * the three exports and the toast text.
 * @param {function(JSDOM): void} setup - Installs fetch routes / DOM content.
 * @param {string} [url] - The page URL.
 */
export async function exportAll(setup, url = `https://chatgpt.com/c/${CONV_ID}`) {
	const dom = installDom(url)
	global.requestAnimationFrame = (cb) => cb()
	Object.defineProperty(dom.window.HTMLElement.prototype, 'innerText', { get() { return this.textContent }, configurable: true })
	const blobs = []
	global.URL.createObjectURL = (b) => (blobs.push(b), `blob:${blobs.length}`)
	global.URL.revokeObjectURL = () => {}
	mock.method(console, 'warn', () => {})
	mock.method(console, 'error', () => {})
	setup(dom)
	const { run } = await import('../src/ChatDump.js?' + Math.random())
	await run()
	const [md, html, txt] = await Promise.all(blobs.slice(-3).map((b) => b.text()))
	return { md, html, txt, toast: document.querySelector('.chatdump-toast').textContent }
}


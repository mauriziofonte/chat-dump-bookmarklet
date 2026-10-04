/**
 * Runs the committed, distributed bookmarklet (decoded exactly as a browser
 * would) in jsdom against mocked same-origin APIs, as the audit did.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { bundle } from '../bundle.js'
import { loadPagedFixture, splitPages, pagedRoutes, loadClaudeFixture, claudeRoutes, CONV_ID, CLAUDE_ID } from './helpers.mjs'

const DIST = new URL('../dist/chatdump.bookmarklet.js', import.meta.url)
const dist = readFileSync(DIST, 'utf8')
const source = decodeURIComponent(dist.slice('javascript:'.length))

test('dist reproduces byte for byte from the pinned source', async () => {
	const { bookmarklet } = await bundle()
	assert.equal(bookmarklet, dist)
})

test('dist is self-contained: no external hosts, script loading or telemetry primitives', () => {
	// The only URL literal is the project link shown in the export preamble
	assert.deepEqual([...new Set(source.match(/https?:\/\/[a-z0-9.\/_-]+/gi))], ['https://github.com/mauriziofonte/chat-dump-bookmarklet'])
	assert.doesNotMatch(source, /sendBeacon|XMLHttpRequest|WebSocket|importScripts|eval\(|new Function|createElement\(["']script/)
	assert.equal((source.match(/\bfetch\(/g) || []).length, 1, 'a single fetch call site (apiFetch)')
})

/** Runs the bookmarklet on a page and returns what it produced. */
async function runDist(pageUrl, routes) {
	const dom = new JSDOM('<body></body>', { url: pageUrl, runScripts: 'outside-only', pretendToBeVisual: true })
	const w = dom.window
	const requests = []
	w.fetch = async (path, init = {}) => {
		requests.push({ path, init })
		const body = routes[path]
		if (body === undefined) return { ok: false, status: 404, redirected: false, url: new URL(path, pageUrl).href }
		return { ok: true, status: 200, redirected: false, url: new URL(path, pageUrl).href, json: async () => body }
	}
	const blobs = []
	w.URL.createObjectURL = (b) => (blobs.push(b), `blob:${blobs.length}`)
	w.URL.revokeObjectURL = () => {}
	w.eval(source)
	for (let i = 0; i < 150 && blobs.length < 3; i++) {
		await new Promise((r) => setTimeout(r, 20))
		if (/Unsupported|No conversations/.test(w.document.querySelector('.chatdump-toast')?.textContent || '')) break
	}
	const read = (blob) =>
		new Promise((resolve) => {
			const fr = new w.FileReader()
			fr.onload = () => resolve(fr.result)
			fr.readAsText(blob)
		})
	const [md, html, txt] = await Promise.all(blobs.slice(0, 3).map(read))
	return { md, html, txt, toast: w.document.querySelector('.chatdump-toast')?.textContent || '', requests, window: w }
}

test('dist on ChatGPT: paginated retrieval, citations, metadata, completeness notice', async () => {
	const pages = splitPages(loadPagedFixture(), [5, 7])
	const out = await runDist(`https://chatgpt.com/c/${CONV_ID}`, pagedRoutes(pages))
	assert.deepEqual(
		out.requests.map((r) => r.path),
		[
			'/api/auth/session',
			`/backend-api/conversations/${CONV_ID}?include_has_versions=true&num_turns=100`,
			`/backend-api/conversations/${CONV_ID}?include_has_versions=true&num_turns=100&before=cursor-1`,
		],
	)
	assert.equal(out.requests[1].init.redirect, 'error')
	assert.match(out.md, /- Models: test-model-alpha\n- Exported: \d{4}-\d\d-\d\dT[\d:.]+Z/)
	assert.match(out.md, /the start of the conversation was reached/)
	assert.match(out.md, /\(\[Acme Wiki\]\(https:\/\/wiki\.example\.org\/acme-x-series\/getting-started\/\), \[Acme Shop\]/)
	assert.doesNotMatch(out.md, /genui|[-]/)
	assert.match(out.toast, /Save as MD/)
	assert.doesNotMatch(out.toast, /incomplete/i)
})

test('dist: injected title does not execute in the HTML export', async () => {
	const pages = splitPages(loadPagedFixture(), [12])
	pages[0].title = '<script>window.__pwned=1</script><img src=x onerror="window.__pwned=1">'
	const out = await runDist(`https://chatgpt.com/c/${CONV_ID}`, pagedRoutes(pages))
	assert.doesNotMatch(out.html, /<script|<img/)
	const probe = new JSDOM(`<body>${out.html}</body>`, { runScripts: 'dangerously' })
	assert.equal(probe.window.__pwned, undefined)
})

test('dist on ChatGPT without API: DOM fallback is labelled possibly incomplete', async () => {
	const dom = new JSDOM('<body></body>', { url: `https://chatgpt.com/c/${CONV_ID}`, runScripts: 'outside-only', pretendToBeVisual: true })
	dom.window.document.body.innerHTML = '<section data-turn="user"><div class="whitespace-pre-wrap">Q</div></section><section data-turn="assistant"><div class="markdown"><p>A</p></div></section>'
	dom.window.fetch = async (path) => ({ ok: false, status: 500, redirected: false, url: path })
	dom.window.URL.createObjectURL = () => 'blob:x'
	dom.window.eval(source)
	for (let i = 0; i < 100 && !dom.window.document.querySelector('.chatdump-toast a'); i++) await new Promise((r) => setTimeout(r, 20))
	const toast = dom.window.document.querySelector('.chatdump-toast').textContent
	assert.match(toast, /Possibly incomplete export/)
})

test('dist on Claude: fixture exports with metadata', async () => {
	const out = await runDist(`https://claude.ai/chat/${CLAUDE_ID}`, claudeRoutes(loadClaudeFixture()))
	assert.match(out.md, /- Models: claude-model-a, claude-model-b/)
	assert.doesNotMatch(out.md, /PRIVATE REASONING/)
})

test('dist refuses look-alike hosts and plain HTTP without making any request', async () => {
	for (const url of [`https://chatgpt.com.attacker.invalid/c/${CONV_ID}`, `https://claude.ai.attacker.invalid/chat/${CLAUDE_ID}`, `http://chatgpt.com/c/${CONV_ID}`]) {
		const out = await runDist(url, {})
		assert.equal(out.requests.length, 0, url)
		assert.match(out.toast, /Unsupported chat engine/, url)
	}
})

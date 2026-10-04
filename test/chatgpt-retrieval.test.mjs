import { test } from 'node:test'
import assert from 'node:assert/strict'
import { installDom, mockFetch, loadPagedFixture, splitPages, pagedRoutes, CONV_ID } from './helpers.mjs'

installDom(`https://chatgpt.com/c/${CONV_ID}`)
const ChatGPTParser = (await import('../src/Parsers/ChatGPTParser.js')).default
const { MAX_PAGES } = await import('../src/ChatGPTApi.js')

const BASE = `/backend-api/conversations/${CONV_ID}?include_has_versions=true&num_turns=100`

const run = () => ChatGPTParser.parseRemote({})
const texts = (r, role) => r.items.filter((i) => i.role === role).map((i) => i.markdown)

test('synthetic paginated JSON: single page, exact endpoint, complete', async () => {
	const full = loadPagedFixture()
	const calls = mockFetch(pagedRoutes(splitPages(full, [12])))
	const r = await run()
	assert.equal(calls[1].path, BASE)
	assert.equal(calls[1].init.headers.authorization, 'Bearer tok-123')
	assert.equal(calls.length, 2)
	assert.equal(r.title, 'Widget Gasket Types')
	assert.equal(r.complete, true)
	assert.deepEqual(r.warnings, [])
	assert.deepEqual(r.stats, { pages: 1, messages: 12, duplicates: 0 })
	assert.deepEqual(
		r.items.map((i) => i.role),
		['PROMPT', 'RESPONSE', 'PROMPT', 'RESPONSE'],
	)
	assert.match(texts(r, 'PROMPT')[0], /^Which gasket size fits/)
	// short preambles are accepted and merged into the response; reasoning stays excluded
	assert.match(texts(r, 'RESPONSE')[0], /^I’ll look up the gasket sizes/)
	assert.match(texts(r, 'RESPONSE')[0], /Typically, “G1,”/)
	assert.doesNotMatch(JSON.stringify(r.items), /Worked for|thoughts|reasoning_recap/)
})

test('pagination follows start_cursor backwards and restores chronological order', async () => {
	const full = loadPagedFixture()
	const calls = mockFetch(pagedRoutes(splitPages(full, [3, 4, 5])))
	const r = await run()
	const paths = calls.map((c) => c.path).filter((p) => p.startsWith('/backend-api'))
	assert.deepEqual(paths, [BASE, `${BASE}&before=cursor-2`, `${BASE}&before=cursor-1`])
	assert.equal(r.complete, true)
	assert.equal(r.stats.pages, 3)
	assert.equal(r.items.length, 4)
	assert.match(texts(r, 'PROMPT')[1], /^And what about the Acme X-series/)
})

test('duplicate ids across pages are removed; conflicting duplicates are reported', async () => {
	const full = loadPagedFixture()
	const pages = splitPages(full, [6, 6])
	pages[1].messages.push(JSON.parse(JSON.stringify(full.messages[6]))) // overlap, identical
	mockFetch(pagedRoutes(pages))
	let r = await run()
	assert.equal(r.stats.duplicates, 1)
	assert.deepEqual(r.warnings, [])
	assert.equal(r.stats.messages, 12)

	const pages2 = splitPages(loadPagedFixture(), [6, 6])
	const changed = JSON.parse(JSON.stringify(full.messages[6]))
	changed.content.parts = ['EDITED']
	changed.update_time += 10
	pages2[1].messages.push(changed)
	mockFetch(pagedRoutes(pages2))
	r = await run()
	assert.equal(r.complete, false)
	assert.match(r.warnings[0], /appears twice with different content/)
	assert.match(texts(r, 'PROMPT')[1], /EDITED/)
})

test('repeated cursor stops pagination and is reported', async () => {
	const pages = splitPages(loadPagedFixture(), [6, 6])
	pages[0].page_info.start_cursor = 'same'
	pages[1].page_info = { start_cursor: 'same', has_previous_page: true }
	mockFetch({ ...pagedRoutes(pages), [`${BASE}&before=same`]: pages[1] })
	const r = await run()
	assert.equal(r.complete, false)
	assert.match(r.warnings.join('\n'), /repeated cursor same/)
})

test('missing pagination metadata makes completeness unverified', async () => {
	const full = loadPagedFixture()
	delete full.page_info
	mockFetch(pagedRoutes([full]))
	const r = await run()
	assert.equal(r.complete, false)
	assert.match(r.warnings[0], /no pagination metadata/)
	assert.equal(r.items.length, 4)
})

test('older page announced without a cursor is reported', async () => {
	const full = loadPagedFixture()
	full.page_info = { has_previous_page: true }
	mockFetch(pagedRoutes([full]))
	const r = await run()
	assert.equal(r.complete, false)
	assert.match(r.warnings[0], /no start_cursor/)
})

test('page safety limit stops endless pagination', async () => {
	const full = loadPagedFixture()
	let n = 0
	const calls = mockFetch({
		'/api/auth/session': { accessToken: 't' },
		[BASE]: () => ({ ...full, page_info: { start_cursor: 'c0', has_previous_page: true } }),
	})
	const origFetch = global.fetch
	global.fetch = async (path, init) => {
		if (path.includes('before=')) {
			n++
			return { ok: true, status: 200, redirected: false, url: path, json: async () => ({ messages: [], page_info: { start_cursor: `c${n}`, has_previous_page: true } }) }
		}
		return origFetch(path, init)
	}
	const r = await run()
	assert.equal(n, MAX_PAGES - 1)
	assert.equal(r.complete, false)
	assert.match(r.warnings.join('\n'), new RegExp(`${MAX_PAGES} pages`))
})

test('current_node not last: trailing messages of another branch are left out and reported', async () => {
	const full = loadPagedFixture()
	full.current_node = full.messages[5].id
	mockFetch(pagedRoutes([full]))
	const r = await run()
	assert.equal(r.items.length, 2)
	assert.match(r.warnings[0], /6 message\(s\) after current_node/)
	assert.equal(r.complete, false)
})

test('current_node missing from the retrieved messages is reported', async () => {
	const full = loadPagedFixture()
	full.current_node = 'unknown-node'
	mockFetch(pagedRoutes([full]))
	const r = await run()
	assert.match(r.warnings[0], /not among the retrieved messages/)
	assert.equal(r.complete, false)
})

test('sibling versions (shared parent_id) are reported, not silently merged', async () => {
	const full = loadPagedFixture()
	const regen = JSON.parse(JSON.stringify(full.messages[5]))
	regen.id = 'regenerated-1'
	regen.content.parts = ['Alternative answer']
	full.messages.splice(5, 0, regen)
	mockFetch(pagedRoutes([full]))
	const r = await run()
	assert.equal(r.complete, false)
	assert.match(r.warnings.join('\n'), /alternate versions/)
})

test('cycle in parent links is reported', async () => {
	const full = loadPagedFixture()
	full.messages[0].metadata.parent_id = full.messages[1].id // 0 -> 1 -> 0
	mockFetch(pagedRoutes([full]))
	const r = await run()
	assert.match(r.warnings.join('\n'), /Cycle in parent links/)
})

// ---- legacy tree format (mapping + current_node) ----
const node = (id, parent, role, text) => ({ id, parent, children: [], message: role ? { id, author: { role }, content: { content_type: 'text', parts: [text] } } : null })
const tree = () => ({
	title: 'Tree',
	current_node: 'a2',
	mapping: {
		root: node('root', null, null),
		u1: node('u1', 'root', 'user', 'Q1'),
		'a1-old': node('a1-old', 'u1', 'assistant', 'ABANDONED'),
		a1: node('a1', 'u1', 'assistant', 'A1'),
		u2: node('u2', 'a1', 'user', 'Q2'),
		a2: node('a2', 'u2', 'assistant', 'A2'),
	},
})
const legacy = (data) => mockFetch({ '/api/auth/session': { accessToken: 't' }, [`/backend-api/conversation/${CONV_ID}`]: data })

test('legacy endpoint fallback keeps only the active branch', async () => {
	legacy(tree())
	const r = await run()
	assert.equal(r.endpoint, 'legacy')
	assert.equal(r.complete, true)
	assert.deepEqual(r.warnings, [])
	assert.deepEqual(
		r.items.map((i) => i.markdown),
		['Q1', 'A1', 'Q2', 'A2'],
	)
})

test('tree: missing parent is reported instead of silently truncating', async () => {
	const data = tree()
	delete data.mapping.a1
	legacy(data)
	const r = await run()
	assert.equal(r.complete, false)
	assert.match(r.warnings[0], /Missing parent node a1/)
	assert.deepEqual(
		r.items.map((i) => i.markdown),
		['Q2', 'A2'],
	)
})

test('tree: cycle is reported', async () => {
	const data = tree()
	data.mapping.u1.parent = 'a2'
	legacy(data)
	const r = await run()
	assert.equal(r.complete, false)
	assert.match(r.warnings[0], /Cycle in the conversation tree/)
})

test('tree: unresolved current_node falls back to the DOM instead of guessing a branch', async () => {
	const data = tree()
	data.current_node = 'gone'
	legacy(data)
	await assert.rejects(run, /unresolved/)
})

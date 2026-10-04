import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mockFetch, loadPagedFixture, splitPages, pagedRoutes, exportAll } from './helpers.mjs'

const domTurns = (dom) => {
	dom.window.document.body.innerHTML =
		'<section data-turn="user"><div class="whitespace-pre-wrap">Visible question</div></section>' +
		'<section data-turn="assistant"><div class="markdown"><p>Visible answer</p></div></section>'
}

test('DOM fallback is labelled as possibly incomplete in every format and in the toast', async () => {
	const out = await exportAll((dom) => {
		mockFetch({}) // every API call 404s
		domTurns(dom)
	})
	assert.match(out.md, /> \*\*Export notice:\*\* INCOMPLETE EXPORT RISK: .*visible page/)
	assert.match(out.md, /API retrieval failed/)
	assert.match(out.html, /<blockquote><p><strong>Export notice:<\/strong> INCOMPLETE EXPORT RISK/)
	assert.match(out.txt, /\[Export notice\] INCOMPLETE EXPORT RISK/)
	assert.match(out.toast, /Possibly incomplete export/)
	assert.doesNotMatch(out.md, /was reached/)
})

test('complete API retrieval states what was verified and shows no warning', async () => {
	const out = await exportAll((dom) => {
		mockFetch(pagedRoutes(splitPages(loadPagedFixture(), [6, 6])))
		domTurns(dom)
	})
	assert.match(out.md, /Retrieved from the conversation API \(2 page\(s\), 12 message\(s\)\); the start of the conversation was reached\./)
	assert.doesNotMatch(out.md, /INCOMPLETE|POSSIBLY/)
	assert.doesNotMatch(out.toast, /incomplete/i)
})

test('API retrieval with problems lists them and warns in the toast', async () => {
	const out = await exportAll((dom) => {
		const full = loadPagedFixture()
		full.current_node = 'unknown'
		mockFetch(pagedRoutes([full]))
		domTurns(dom)
	})
	assert.match(out.md, /POSSIBLY INCOMPLETE: retrieved from the conversation API/)
	assert.match(out.md, /> - current_node unknown is not among the retrieved messages/)
	assert.match(out.html, /<li>current_node unknown is not among/)
	assert.match(out.toast, /Possibly incomplete export/)
})

test('notice text from the server is escaped in HTML', async () => {
	const out = await exportAll((dom) => {
		const full = loadPagedFixture()
		full.current_node = '<img src=x onerror=1>'
		mockFetch(pagedRoutes([full]))
		domTurns(dom)
	})
	assert.doesNotMatch(out.html, /<img src=x/)
	assert.match(out.html, /&lt;img src=x onerror=1&gt;/)
})

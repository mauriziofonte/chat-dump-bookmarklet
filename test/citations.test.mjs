import { test } from 'node:test'
import assert from 'node:assert/strict'
import { installDom, mockFetch, loadPagedFixture, splitPages, pagedRoutes, CONV_ID } from './helpers.mjs'

installDom(`https://chatgpt.com/c/${CONV_ID}`)
const { convertCitations } = await import('../src/Citations.js')
const ChatGPTParser = (await import('../src/Parsers/ChatGPTParser.js')).default
const { renderMarkdown } = await import('../src/MarkdownRenderer.js')

// Private-use delimiters ChatGPT wraps around citation markers
const OPEN = String.fromCharCode(0xe200)
const SEP = String.fromCharCode(0xe202)
const CLOSE = String.fromCharCode(0xe201)
const genui = (payload) => `${OPEN}genui${SEP}${JSON.stringify(payload)}${CLOSE}`
const ref = (matched, items, extra) => ({ matched_text: matched, start_idx: 0, type: 'grouped_webpages', items, ...extra })
const item = (url, attribution, extra) => ({ title: `Title of ${attribution}`, url, attribution, supporting_websites: null, ...extra })

test('synthetic fixture: single and multiple sources, supporting websites, utm_source removed', () => {
	const d = loadPagedFixture()
	const one = d.messages[5]
	const out1 = convertCitations(one.content.parts[0], one.metadata)
	assert.match(out1, /§4\.2\. \(\[docs\.example\.com\]\(https:\/\/docs\.example\.com\/gaskets\/g1-datasheet\.html\)\)/)
	assert.match(out1, /\(\[docs\.example\.com\]\(https:\/\/docs\.example\.com\/gaskets\/g3-overview\.html\)\)/)
	assert.doesNotMatch(out1, /genui|utm_source|unresolved/)

	const two = d.messages[11]
	const out2 = convertCitations(two.content.parts[0], two.metadata)
	assert.match(out2, /\(\[Acme Wiki\]\(https:\/\/wiki\.example\.org\/acme-x-series\/getting-started\/\), \[Acme Shop\]\(https:\/\/shop\.example\.net\/gasket-kit-p-5475\.html\)\)/)
	assert.doesNotMatch(out2, /genui|utm_source|unresolved/)
	// no invisible private-use characters survive
	assert.doesNotMatch(out1 + out2, /[-]/)
})

test('bare genui text (delimiters lost) converts too', () => {
	const marker = 'genui{"citation":{"ref":"t1"}}'
	const out = convertCitations(`Claim. ${marker}`, { content_references: [ref(marker, [item('https://a.example/x', 'a.example')])] })
	assert.equal(out, 'Claim. ([a.example](https://a.example/x))')
})

test('unresolved references stay visible; no URL is invented', () => {
	const m1 = genui({ citation: { refs: ['turn9view1', 'turn9view2'] } })
	const m2 = genui({ citation: { ref: 'turn3view0' } })
	const m3 = genui({ citation: { ref: 'turn4view0' } })
	const text = `A ${m1} B ${m2} C ${m3}`
	const out = convertCitations(text, {
		content_references: [
			ref(m1, [], { status: 'error' }), // reference without any source
			ref(m3, [item('javascript:alert(1)', 'evil')]), // unusable URL
		],
	})
	assert.equal(out, 'A [Citation unresolved: turn9view1, turn9view2] B [Citation unresolved: turn3view0] C [Citation unresolved: turn4view0]')
	assert.doesNotMatch(out, /http|javascript/)
})

test('a marker without any content_references is marked, not dropped', () => {
	const out = convertCitations(`x ${genui({ citation: { ref: 'r1' } })}`, undefined)
	assert.equal(out, 'x [Citation unresolved: r1]')
})

test('code examples and inline code keep literal markers', () => {
	const m = genui({ citation: { ref: 'r1' } })
	const text = ['Doc ' + m, '', '```js', `const s = '${m}'`, '```', '', `Inline \`${m}\` stays.`].join('\n')
	const out = convertCitations(text, { content_references: [ref(m, [item('https://a.example/', 'a')])] })
	const lines = out.split('\n')
	assert.equal(lines[0], 'Doc ([a](https://a.example/))')
	assert.equal(lines[3], `const s = '${m}'`)
	assert.equal(lines[6], `Inline \`${m}\` stays.`)
})

test('repeated identical markers map to their own references in order', () => {
	const m = genui({ citation: { ref: 'r1' } })
	const text = `one ${m} two ${m}`
	const refs = [
		{ ...ref(m, [item('https://first.example/', 'first')]), start_idx: text.indexOf(m) },
		{ ...ref(m, [item('https://second.example/', 'second')]), start_idx: text.lastIndexOf(m) },
	]
	assert.equal(convertCitations(text, { content_references: refs }), 'one ([first](https://first.example/)) two ([second](https://second.example/))')
})

test('start_idx counted in code points still finds the right marker', () => {
	const m = genui({ citation: { ref: 'r1' } })
	const text = `😀😀 first ${m} then ${m}`
	const cpIndex = (n) => Array.from(text.slice(0, n)).length
	const refs = [
		{ ...ref(m, [item('https://one.example/', 'one')]), start_idx: cpIndex(text.indexOf(m)) },
		{ ...ref(m, [item('https://two.example/', 'two')]), start_idx: cpIndex(text.lastIndexOf(m)) },
	]
	assert.equal(convertCitations(text, { content_references: refs }), '😀😀 first ([one](https://one.example/)) then ([two](https://two.example/))')
})

test('URLs with parentheses and brackets in labels produce valid Markdown links', () => {
	const m = genui({ citation: { ref: 'r1' } })
	const out = convertCitations(m, { content_references: [ref(m, [item('https://en.example/wiki/Foo_(bar)', 'A [b] c')])] })
	assert.equal(out, '([A b c](https://en.example/wiki/Foo_%28bar%29))')
})

test('older formats: cite markers, entities and numbered source brackets', () => {
	const cite = `${OPEN}cite${SEP}turn0search0${SEP}turn0search1${CLOSE}`
	const entity = `${OPEN}entity${SEP}["city","Paris","capital of France"]${CLOSE}`
	const text = `Fact ${cite}. Visit ${entity}. Old 【 3†source】 and plain 【note】.`.replace(/【 3/, '【3')
	const out = convertCitations(text, {
		content_references: [{ matched_text: cite, start_idx: 5, type: 'grouped_webpages', items: [item('https://s1.example/', 's1'), item('https://s2.example/', 's2')] }],
		citations: [],
	})
	assert.match(out, /^Fact \(\[s1\]\(https:\/\/s1\.example\/\), \[s2\]\(https:\/\/s2\.example\/\)\)\. Visit Paris\. /)
	assert.match(out, /\[Citation unresolved: 【3†source】\]/)
	assert.match(out, /plain 【note】\./)

	const old = 'See 【1†source】.'
	const resolved = convertCitations(old, { citations: [{ start_ix: 4, end_ix: 15, metadata: { title: 'T', url: 'https://old.example/p' } }] })
	assert.equal(resolved, 'See ([T](https://old.example/p)).')
})

test('parser: assistant citations convert, user text with the same marker stays literal', async () => {
	const full = loadPagedFixture()
	const literal = 'genui{"citation":{"ref":"user-typed"}}'
	full.messages[0].content.parts = [`Explain this literal: ${literal}`]
	mockFetch(pagedRoutes(splitPages(full, [12])))
	const r = await ChatGPTParser.parseRemote({})
	assert.match(r.items[0].markdown, new RegExp(literal.replace(/[{}]/g, '\\$&')))
	assert.match(r.items[1].markdown, /\(\[docs\.example\.com\]\(https:\/\/docs/)
	assert.doesNotMatch(r.items[1].markdown, /genui/)
})

test('HTML export renders converted citations as links', () => {
	const m = genui({ citation: { ref: 'r1' } })
	const md = convertCitations(`Claim ${m}`, { content_references: [ref(m, [item('https://a.example/?q=1&r=2', 'a.example')])] })
	assert.match(renderMarkdown(md), /<a href="https:\/\/a\.example\/\?q=1&amp;r=2">a\.example<\/a>/)
})

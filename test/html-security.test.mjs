import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { installDom } from './helpers.mjs'

installDom('https://chatgpt.com/c/11111111-2222-3333-4444-555555555555')
const { formatAsHtml, formatAsMarkdown, formatAsTxt } = await import('../src/OutputFormatter.js')
const { escapeHtml, safeHttpUrl, htmlLink } = await import('../src/Html.js')

const item = (extra) => ({ role: 'PROMPT', num: 1, markdown: 'hello', ...extra })

/** Parses generated HTML with scripts enabled and reports what executes. */
function execute(html) {
	const dom = new JSDOM(`<body>${html}</body>`, { runScripts: 'dangerously' })
	dom.window.__pwned = false
	return dom
}

test('escapeHtml covers text and attribute contexts', () => {
	assert.equal(escapeHtml(`<a href="x" onclick='y'>&`), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;')
})

test('title injection does not create elements', () => {
	const html = formatAsHtml([item()], '<script>window.__pwned=true</script><img src=x onerror="window.__pwned=true">')
	const dom = execute(html)
	assert.equal(dom.window.document.querySelectorAll('script, img').length, 0)
	assert.equal(dom.window.__pwned, false)
	assert.match(dom.window.document.querySelector('h1').textContent, /<script>window\.__pwned=true<\/script>/)
})

test('attachment name injection does not create elements', () => {
	const html = formatAsHtml([item({ attachments: ['<img src=x onerror="window.__pwned=true">.png', 'a"><svg onload=1>'] })], 'T')
	const dom = execute(html)
	assert.equal(dom.window.document.querySelectorAll('img, svg').length, 0)
	const line = [...dom.window.document.querySelectorAll('p em')].find((e) => e.textContent.startsWith('Attachments'))
	assert.match(line.textContent, /<img src=x/)
})

test('preamble link: page URL is validated and escaped', () => {
	installDom('https://chatgpt.com/c/11111111-2222-3333-4444-555555555555?x="><script>1</script>')
	const html = formatAsHtml([item()], 'T')
	const dom = execute(html)
	assert.equal(dom.window.document.querySelectorAll('script').length, 0)
	const links = [...dom.window.document.querySelectorAll('p em a')]
	assert.equal(links.length, 2)
	for (const a of links) assert.match(a.getAttribute('href'), /^https:\/\//)
	assert.equal(links[0].getAttribute('rel'), 'noopener noreferrer')
})

test('safeHttpUrl only allows http(s)', () => {
	assert.equal(safeHttpUrl('javascript:alert(1)'), null)
	assert.equal(safeHttpUrl('data:text/html,<script>'), null)
	assert.equal(safeHttpUrl('not a url'), null)
	assert.equal(safeHttpUrl('https://example.com/a b'), 'https://example.com/a%20b')
	assert.equal(htmlLink('javascript:alert(1)', '<b>'), '&lt;b&gt;')
})

test('markdown and txt keep titles and attachment names on one line', () => {
	const md = formatAsMarkdown([item({ attachments: ['a\n## injected.txt'] })], 'Title\n## Fake heading')
	assert.match(md, /^# Title ## Fake heading\n/)
	assert.doesNotMatch(md, /\n## injected/)
	const txt = formatAsTxt([item({ attachments: ['a\nb'] })], 'T\nU')
	assert.match(txt, /^T U\n/)
})

test('rendered markdown links never carry javascript: URLs', async () => {
	const { renderMarkdown } = await import('../src/MarkdownRenderer.js')
	const html = renderMarkdown('[x](javascript:alert(1)) [y](https://e.com/?a="onmouseover="1)')
	assert.doesNotMatch(html, /javascript:/)
	const dom = execute(html)
	assert.equal(dom.window.document.querySelector('a').getAttribute('onmouseover'), null)
})

test('markdown preamble link keeps parentheses and brackets from breaking the link', () => {
	installDom('https://chatgpt.com/c/11111111-2222-3333-4444-555555555555?q=(a)[b]')
	const md = formatAsMarkdown([item()], 'T')
	assert.match(md, /\[https:\/\/chatgpt\.com\/c\/[^\]]*\\\[b\\\]\]\(https:\/\/chatgpt\.com\/c\/[^)]*%28a%29/)
})

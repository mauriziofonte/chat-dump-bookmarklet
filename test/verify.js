#!/usr/bin/env node
/**
 * Verification harness: runs the real parsers (and full pipeline) against
 * the HTML dumps saved in the project root, and reports what gets extracted.
 *
 * Usage: node test/verify.js [--full] [pattern]
 */
import { readFileSync, readdirSync } from 'node:fs'
import { JSDOM } from 'jsdom'

const FULL = process.argv.includes('--full')
const pattern = process.argv.find((a) => !a.startsWith('-') && /\.html$/.test(a) === false && /^(chatgpt|gemini|claude)/.test(a))

const dumps = readdirSync('.')
	.filter((f) => /^(chatgpt|gemini|claude)-\d+\.html$/.test(f))
	.filter((f) => (pattern ? f.startsWith(pattern) : true))
	.sort()

for (const file of dumps) {
	const html = readFileSync(file, 'utf8')
	const dom = new JSDOM(html, { url: urlFor(file) })

	// Parsers and processor rely on browser globals
	global.window = dom.window
	global.document = dom.window.document
	global.DOMParser = dom.window.DOMParser
	global.NodeFilter = dom.window.NodeFilter
	// jsdom does not implement innerText; non-rendered elements fall back to textContent per spec
	Object.defineProperty(dom.window.HTMLElement.prototype, 'innerText', {
		get() {
			return this.textContent
		},
		configurable: true,
	})

	const { getPlatformParser } = await import('../src/ParserFactory.js?' + file)
	const parser = getPlatformParser()
	if (!parser) {
		console.log(`${file}: NO PARSER MATCHED`)
		continue
	}

	const items = parser.parse(dom.window.document.body)
	console.log(`\n=== ${file} (parser: ${parser.name}) — ${items.length} items ===`)
	for (const it of items) {
		const text = (it.content.textContent || '').replace(/\s+/g, ' ').trim()
		console.log(`  ${it.role} #${it.num}: ${text.length} chars | "${text.slice(0, 80)}"`)
	}

	if (FULL && items.length) {
		const { processConversations } = await import('../src/ConversationProcessor.js?' + file)
		const { formatAsMarkdown } = await import('../src/OutputFormatter.js?' + file)
		const processed = processConversations(items)
		const md = formatAsMarkdown(processed, dom.window.document.title || file)
		console.log(`  --- markdown: ${md.length} chars, code fences: ${(md.match(/```/g) || []).length} ---`)
	}
}

function urlFor(file) {
	if (file.startsWith('chatgpt')) return 'https://chatgpt.com/c/test'
	if (file.startsWith('gemini')) return 'https://gemini.google.com/app/test'
	return 'https://claude.ai/chat/test'
}

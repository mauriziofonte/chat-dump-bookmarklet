/**
 * Compact Markdown-to-HTML renderer for the HTML export of API-extracted
 * conversations (Markdown source, no DOM node available). Covers the subset
 * emitted by the platforms: headings, paragraphs, fenced code, lists, GFM
 * tables, blockquotes, horizontal rules and the usual inline marks.
 *
 * The output is only ever written to a Blob / clipboard, never injected into
 * the live page, so no Trusted Types sink is involved.
 */

/**
 * Escapes HTML special characters.
 * @param {string} text - Raw text.
 * @returns {string} Escaped text.
 */
function _esc(text) {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Renders inline Markdown marks (code, bold, italic, strikethrough, links).
 * @param {string} text - A single line of Markdown (already trimmed).
 * @returns {string} HTML for the line.
 */
function _inline(text) {
	let html = _esc(text)
	html = html.replace(/`([^`]+)`/g, (m, code) => `<code>${code}</code>`)
	html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
	html = html.replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
	html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>')
	html = html.replace(/!?\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
		return /^(https?:|mailto:|#)/i.test(href) ? `<a href="${href}">${label}</a>` : label
	})
	return html
}

/**
 * Renders a GFM table block.
 * @param {string[]} rows - The raw table lines.
 * @returns {string} The <table> HTML.
 */
function _table(rows) {
	const cells = (line) =>
		line
			.replace(/^\s*\|/, '')
			.replace(/\|\s*$/, '')
			.split('|')
			.map((c) => _inline(c.trim()))
	const head = cells(rows[0])
	const body = rows.slice(2).map(cells)
	const thead = `<thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead>`
	const tbody = body.length ? `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>` : ''
	return `<table>${thead}${tbody}</table>`
}

/**
 * Converts Markdown source to an HTML fragment string.
 * @param {string} markdown - The Markdown source.
 * @returns {string} The HTML fragment.
 */
export function renderMarkdown(markdown) {
	const lines = markdown.replace(/\r\n/g, '\n').split('\n')
	const out = []
	let paragraph = []
	let list = null // { tag: 'ul'|'ol', items: [] }

	const flushParagraph = () => {
		if (paragraph.length) {
			out.push(`<p>${paragraph.map(_inline).join('<br>')}</p>`)
			paragraph = []
		}
	}
	const flushList = () => {
		if (list) {
			out.push(`<${list.tag}>${list.items.map((i) => `<li>${i}</li>`).join('')}</${list.tag}>`)
			list = null
		}
	}
	const flushAll = () => {
		flushParagraph()
		flushList()
	}

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		const trimmed = line.trim()

		// fenced code blocks (``` or ````, optional language)
		const fenceMatch = trimmed.match(/^(`{3,})(\w*)\s*$/)
		if (fenceMatch) {
			flushAll()
			const fence = fenceMatch[1]
			const lang = fenceMatch[2]
			const code = []
			i++
			while (i < lines.length && lines[i].trim() !== fence) {
				code.push(lines[i])
				i++
			}
			const cls = lang ? ` class="language-${lang}"` : ''
			out.push(`<pre><code${cls}>${_esc(code.join('\n'))}</code></pre>`)
			continue
		}

		if (!trimmed) {
			flushAll()
			continue
		}

		const heading = trimmed.match(/^(#{1,6})\s+(.*)$/)
		if (heading) {
			flushAll()
			out.push(`<h${heading[1].length}>${_inline(heading[2])}</h${heading[1].length}>`)
			continue
		}

		if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
			flushAll()
			out.push('<hr>')
			continue
		}

		if (/^>/.test(trimmed)) {
			flushAll()
			const quote = [trimmed.replace(/^>\s?/, '')]
			while (i + 1 < lines.length && /^\s*>/.test(lines[i + 1])) {
				i++
				quote.push(lines[i].trim().replace(/^>\s?/, ''))
			}
			out.push(`<blockquote><p>${quote.map(_inline).join('<br>')}</p></blockquote>`)
			continue
		}

		// GFM table: header row followed by a separator row
		if (/^\|.*\|/.test(trimmed) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
			flushAll()
			const rows = [trimmed]
			i++
			rows.push(lines[i].trim())
			while (i + 1 < lines.length && /^\s*\|.*\|/.test(lines[i + 1])) {
				i++
				rows.push(lines[i].trim())
			}
			out.push(_table(rows))
			continue
		}

		const bullet = trimmed.match(/^[-*+]\s+(.*)$/)
		const ordered = trimmed.match(/^\d+[.)]\s+(.*)$/)
		if (bullet || ordered) {
			flushParagraph()
			const tag = bullet ? 'ul' : 'ol'
			if (!list || list.tag !== tag) {
				flushList()
				list = { tag, items: [] }
			}
			list.items.push(_inline(bullet ? bullet[1] : ordered[1]))
			continue
		}

		// list item continuation (indented line while a list is open)
		if (list && /^\s{2,}/.test(line)) {
			list.items[list.items.length - 1] += `<br>${_inline(trimmed)}`
			continue
		}

		flushList()
		paragraph.push(trimmed)
	}
	flushAll()
	return out.join('\n')
}

/**
 * Converts ChatGPT citation markers into Markdown links using the message's
 * metadata (content_references, and metadata.citations for the older
 * \u3010n\u2020source\u3011 style). Markers that cannot be resolved stay visible as
 * "[Citation unresolved: ...]"; no URL is ever constructed.
 *
 * Only assistant text is converted, and never inside fenced or inline code.
 */
import { t } from './I18n.js'
import { safeHttpUrl } from './Html.js'

// Current markers: \ue200genui\ue202{"citation":{"ref"|"refs":...}}\ue201. The private-use
// delimiters are invisible and optional here, so text that lost them still converts.
const GENUI = /\ue200?genui\ue202?\{"citation":\{[^{}]*\}\}\ue201?/g
// Older markers: private-use delimiters (cite / entity) and the browsing-era \u3010n\u2020source\u3011 form
const PUA_CITE = /\ue200cite(?:\ue202[^\ue200-\ue202]+)+\ue201/g
const PUA_ENTITY = /\ue200entity\ue202\[[^\ue200-\ue202]*\]\ue201/g
const BRACKET = /\u3010[^\u3011\n]*\u3011/g
const MARKER = /^(?:\ue200?genui|\ue200cite|\u3010)/

/**
 * Finds fenced and inline code spans, which must stay literal.
 * @param {string} text - The Markdown text.
 * @returns {number[][]} [start, end) offsets.
 */
function codeRanges(text) {
	const ranges = []
	let fence = null
	let start = 0
	let pos = 0
	for (const line of text.split('\n')) {
		const m = line.match(/^\s*(`{3,}|~{3,})/)
		if (m && !fence) {
			fence = m[1]
			start = pos
		} else if (m && m[1].charAt(0) === fence.charAt(0) && m[1].length >= fence.length) {
			ranges.push([start, pos + line.length])
			fence = null
		}
		pos += line.length + 1
	}
	if (fence) ranges.push([start, text.length])
	const inline = /(`+)(?!`)[^\n]*?[^`\n]\1(?!`)/g
	let m
	while ((m = inline.exec(text))) ranges.push([m.index, m.index + m[0].length])
	return ranges
}

/**
 * Removes ChatGPT's own tracking parameter from a URL and validates it.
 * @param {string} url - The URL from the metadata.
 * @returns {string|null} A clean http(s) URL, or null when unusable.
 */
function cleanUrl(url) {
	const href = safeHttpUrl(url)
	if (!href) return null
	const parsed = new URL(href)
	if (parsed.searchParams.get('utm_source') === 'chatgpt.com') {
		parsed.searchParams.delete('utm_source')
	}
	return parsed.href.replace(/\(/g, '%28').replace(/\)/g, '%29')
}

/**
 * Builds one Markdown link; brackets are dropped from the label because the
 * export renderers do not support escaping them.
 * @param {object} source - An object with url and optional attribution/title.
 * @returns {string|null} The link, or null when the URL is unusable.
 */
function link(source) {
	const href = cleanUrl(source.url)
	if (!href) return null
	const label = (source.attribution || source.title || new URL(href).hostname).replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim()
	return `[${label}](${href})`
}

/**
 * Collects the distinct links of a content reference: its items, their
 * supporting websites, a single-page reference, or (last resort) safe_urls.
 * @param {object} ref - A content_references entry.
 * @returns {string[]} Markdown links.
 */
function linksOf(ref) {
	const sources = []
	for (const item of Array.isArray(ref.items) ? ref.items : []) {
		sources.push(item, ...(Array.isArray(item.supporting_websites) ? item.supporting_websites : []))
	}
	if (!sources.length && ref.url) sources.push(ref)
	if (!sources.length) {
		for (const url of Array.isArray(ref.safe_urls) ? ref.safe_urls : []) sources.push({ url })
	}
	const links = []
	for (const source of sources) {
		const md = source && link(source)
		if (md && !links.includes(md)) links.push(md)
	}
	return links
}

/**
 * Extracts the reference ids named by a marker, for the unresolved note.
 * @param {string} marker - The marker text.
 * @returns {string} Comma-separated ids, or the marker itself when not parseable.
 */
function markerIds(marker) {
	try {
		if (marker.includes('genui')) {
			const c = JSON.parse(marker.slice(marker.indexOf('{')).replace(/\ue201$/, '')).citation
			return [].concat(c.refs || c.ref || []).join(', ')
		}
	} catch (e) {
		// fall through to the raw marker
	}
	if (marker.charAt(0) === '\ue200') return marker.split('\ue202').slice(1).join(', ').replace(/\ue201/g, '')
	return marker
}

const unresolved = (marker) => `[${t('citation_unresolved')}: ${markerIds(marker)}]`

/**
 * Locates a reference's marker in the text: the occurrence closest to its
 * start_idx among those not yet claimed. start_idx may count code points, so
 * both interpretations are tried as the target position.
 * @param {string} text - The message text.
 * @param {object} ref - A content_references entry.
 * @param {Set<number>} claimed - Start offsets already used.
 * @returns {number} The offset, or -1.
 */
function locate(text, ref, claimed) {
	const needle = ref.matched_text
	const targets = [ref.start_idx]
	if (typeof ref.start_idx === 'number') {
		const cps = Array.from(text)
		targets.push(cps.slice(0, ref.start_idx).join('').length)
	}
	let best = -1
	let bestDistance = Infinity
	for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + 1)) {
		if (claimed.has(at)) continue
		const distance = Math.min(...targets.map((tg) => (typeof tg === 'number' ? Math.abs(tg - at) : 0)))
		if (distance < bestDistance) {
			best = at
			bestDistance = distance
		}
	}
	return best
}

/**
 * Converts the citation markers in an assistant message's Markdown.
 * @param {string} text - The Markdown text of the message.
 * @param {object} [metadata] - The message metadata (content_references, citations).
 * @returns {string} The text with markers replaced by links or visible unresolved notes.
 */
export function convertCitations(text, metadata) {
	if (!/genui|\ue200|\u3010/.test(text)) return text
	const refs = metadata && Array.isArray(metadata.content_references) ? metadata.content_references : []
	const ranges = codeRanges(text)
	const inCode = (i) => ranges.some((r) => i >= r[0] && i < r[1])
	const edits = []
	const claimed = new Set()
	const overlaps = (s, e) => edits.some((x) => s < x.end && e > x.start)

	for (const ref of refs.slice().sort((a, b) => (a.start_idx || 0) - (b.start_idx || 0))) {
		if (!ref || typeof ref.matched_text !== 'string' || !MARKER.test(ref.matched_text)) continue
		const at = locate(text, ref, claimed)
		if (at < 0 || inCode(at)) continue
		const links = linksOf(ref)
		claimed.add(at)
		edits.push({ start: at, end: at + ref.matched_text.length, text: links.length ? `(${links.join(', ')})` : unresolved(ref.matched_text) })
	}

	// Older browsing citations: metadata.citations[].start_ix points at the \u3010\u2026\u3011 marker
	const old = metadata && Array.isArray(metadata.citations) ? metadata.citations : []
	const sweep = (re, make) => {
		let m
		re.lastIndex = 0
		while ((m = re.exec(text))) {
			const s = m.index
			const e = s + m[0].length
			if (!inCode(s) && !overlaps(s, e)) edits.push({ start: s, end: e, text: make(m[0], s) })
		}
	}
	sweep(BRACKET, (marker, s) => {
		if (!/\u2020/.test(marker)) return marker // ordinary bracketed text
		const c = old.find((x) => x.start_ix === s)
		const md = c && c.metadata && c.metadata.url ? link(c.metadata) : null
		return md ? `(${md})` : unresolved(marker)
	})
	sweep(PUA_ENTITY, (marker) => {
		try {
			return String(JSON.parse(marker.slice(2, -1).split('\ue202')[1])[1])
		} catch (e) {
			return unresolved(marker)
		}
	})
	sweep(PUA_CITE, unresolved)
	sweep(GENUI, unresolved)

	let out = text
	for (const edit of edits.sort((a, b) => b.start - a.start)) {
		out = out.slice(0, edit.start) + edit.text + out.slice(edit.end)
	}
	return out
}

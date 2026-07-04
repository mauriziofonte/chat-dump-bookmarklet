import '../../types.js'
import { createConversationItem } from '../ConversationProcessor.js'

const CONVERSATION_PATH = /\/app\/([a-z0-9]+)/i
const RPC_ID = 'hNvQHb'
const PAGE_SIZE = 100
const FILENAME = /^[^/\\:*?"<>|$]{1,120}\.[a-z0-9]{2,6}$/i

/**
 * Recursively collects attachment file names from the opaque nested arrays of
 * a user-message record (exact indices drift between builds; file names are
 * the only plain "name.ext" strings in there).
 * @param {*} node - Any node of the nested-array structure.
 * @param {string[]} names - Accumulator.
 * @returns {string[]} The accumulator.
 */
function _collectFilenames(node, names) {
	if (typeof node === 'string') {
		if (FILENAME.test(node) && !names.includes(node)) {
			names.push(node)
		}
	} else if (Array.isArray(node)) {
		for (const child of node) {
			_collectFilenames(child, names)
		}
	}
	return names
}

/**
 * Calls the batchexecute RPC that loads a conversation page.
 * @param {string} conversationId - The "c_..." conversation id.
 * @param {number} count - Max turns to return.
 * @param {string|null} cursor - Continuation token from a previous page.
 * @returns {Promise<any>} The decoded RPC payload.
 * @throws {Error} on HTTP errors, missing auth token or undecodable payloads.
 */
async function _rpc(conversationId, count, cursor) {
	const wiz = window.WIZ_global_data || {}
	const at = wiz.SNlM0e
	if (!at) {
		throw new Error('WIZ_global_data.SNlM0e (at token) not found')
	}
	const lang = ((typeof navigator !== 'undefined' && navigator.language) || 'en').split('-')[0]
	const query = [
		`rpcids=${RPC_ID}`,
		`source-path=${encodeURIComponent(window.location.pathname)}`,
		wiz.cfb2h ? `bl=${encodeURIComponent(wiz.cfb2h)}` : '',
		wiz.FdrFJe ? `f.sid=${encodeURIComponent(wiz.FdrFJe)}` : '',
		`hl=${encodeURIComponent(lang)}`,
		`_reqid=${Math.floor(100000 + (Date.now() % 900000))}`,
	]
		.filter(Boolean)
		.join('&')
	const inner = JSON.stringify([conversationId, count, cursor, 1, [0], [4], null, 1])
	const freq = JSON.stringify([[[RPC_ID, inner, null, 'generic']]])

	const response = await fetch(`/_/BardChatUi/data/batchexecute?${query}`, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
		body: `f.req=${encodeURIComponent(freq)}&at=${encodeURIComponent(at)}`,
	})
	if (!response.ok) {
		throw new Error(`batchexecute returned ${response.status}`)
	}
	const text = await response.text()

	// Anti-JSON envelope: ")]}'" prefix, then length lines interleaved with
	// one-line JSON chunks. The wrb.fr entry carries the payload as a JSON string.
	for (const line of text.split('\n')) {
		if (line.charAt(0) !== '[') continue
		let chunk
		try {
			chunk = JSON.parse(line)
		} catch (e) {
			continue
		}
		for (const entry of Array.isArray(chunk) ? chunk : []) {
			if (Array.isArray(entry) && entry[0] === 'wrb.fr' && entry[1] === RPC_ID && typeof entry[2] === 'string') {
				return JSON.parse(entry[2])
			}
		}
	}
	throw new Error('no wrb.fr payload in batchexecute response')
}

/**
 * Maps the RPC turn records (newest first) to conversation items.
 * Each record: [0]=[c_id, r_id], [1]=[c_id, parent r_id, chosen rc_id],
 * [2][0][0]=user text (attachments nested in [2][0][4]),
 * [3][0]=response candidates as [rc_id, [markdown, ...], ...].
 * @param {any[]} turns - The turn records, chronological order.
 * @returns {ConversationItem[]}
 */
function _mapTurns(turns) {
	// Regenerated responses leave several candidates: the one referenced by the
	// next turn's parent pointer is the branch actually continued.
	const chosen = {}
	for (const turn of turns) {
		if (Array.isArray(turn[1]) && typeof turn[1][2] === 'string') {
			chosen[turn[1][2]] = true
		}
	}

	const items = []
	let promptNum = 0
	let responseNum = 0
	// Each record repeats the conversation's whole attachment set: list every
	// file only at its first chronological occurrence.
	const listed = {}
	for (const turn of turns) {
		const user = (Array.isArray(turn[2]) && turn[2][0]) || []
		const text = typeof user[0] === 'string' ? user[0].trim() : ''
		const attachments = _collectFilenames(user[4], []).filter((name) => {
			if (listed[name]) return false
			listed[name] = true
			return true
		})
		if (text || attachments.length) {
			items.push(createConversationItem({ role: 'PROMPT', num: ++promptNum, markdown: text, attachments }))
		}
		const candidates = (Array.isArray(turn[3]) && turn[3][0]) || []
		const pick = candidates.find((c) => Array.isArray(c) && chosen[c[0]]) || candidates[0]
		const responseText = pick && Array.isArray(pick[1]) && typeof pick[1][0] === 'string' ? pick[1][0].trim() : ''
		if (responseText) {
			items.push(createConversationItem({ role: 'RESPONSE', num: ++responseNum, markdown: responseText }))
		}
	}
	return items
}

/** @type {ParserModule} */
const GeminiParser = {
	name: 'gemini',
	matches: (hostname) => hostname.includes('gemini.google.com'),

	/**
	 * API-based extraction. gemini.google.com lazy-loads the message list
	 * (only the most recent turns are in the DOM until the user scrolls), so a
	 * complete export goes through the same batchexecute RPC the app uses,
	 * following the continuation cursor across pages. If pagination stalls and
	 * the live DOM holds more turns than the API returned (user scrolled the
	 * whole history), the DOM parser is preferred by returning null.
	 * @returns {Promise<RemoteConversation|null>}
	 */
	parseRemote: async () => {
		if (typeof fetch !== 'function') {
			return null
		}
		const pathMatch = window.location.pathname.match(CONVERSATION_PATH)
		if (!pathMatch) {
			return null
		}
		const conversationId = `c_${pathMatch[1]}`

		let pageSize = PAGE_SIZE
		let payload
		try {
			payload = await _rpc(conversationId, pageSize, null)
		} catch (e) {
			// oversized page rejected? retry once with the size the app itself uses
			pageSize = 10
			payload = await _rpc(conversationId, pageSize, null)
		}

		const turns = []
		const seen = {}
		let cursor = null
		let stalled = false
		for (let page = 0; page < 50 && payload; page++) {
			const records = Array.isArray(payload[0]) ? payload[0] : []
			let added = 0
			for (const record of records) {
				const id = (Array.isArray(record[0]) && record[0][1]) || JSON.stringify(record[0])
				if (!seen[id]) {
					seen[id] = true
					turns.push(record)
					added++
				}
			}
			cursor = typeof payload[1] === 'string' && payload[1] ? payload[1] : null
			if (!cursor || !added) {
				break
			}
			try {
				payload = await _rpc(conversationId, pageSize, cursor)
			} catch (e) {
				stalled = true
				break
			}
		}
		if (!turns.length) {
			return null
		}

		// Records come newest first: restore chronological order.
		turns.reverse()

		// If we could not drain the cursor and the human-scrolled DOM is richer,
		// let the DOM parser win.
		if (stalled && document.querySelectorAll('div.conversation-container').length > turns.length) {
			return null
		}

		const items = _mapTurns(turns)
		if (!items.length) {
			return null
		}
		return { title: document.title, items }
	},

	parse: (body) => {
		const conversations = []
		body.querySelectorAll('div.conversation-container').forEach((n, i) => {
			const query = n.querySelector('div.query-content')
			const response = n.querySelector('div.response-content')
			if (!query || !response) return

			conversations.push(
				createConversationItem({
					role: 'PROMPT',
					num: i + 1,
					content: query,
				}),
			)
			conversations.push(
				createConversationItem({
					role: 'RESPONSE',
					num: i + 1,
					content: response,
				}),
			)
		})
		return conversations
	},
}

export default GeminiParser

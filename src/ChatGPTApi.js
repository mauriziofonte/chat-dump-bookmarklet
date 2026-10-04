/**
 * ChatGPT conversation retrieval: paginated endpoint, deduplication and
 * active-branch resolution. Everything that cannot be verified becomes an
 * entry in `warnings` (shown in the export) instead of being dropped or
 * merged silently.
 */
import { apiGet } from './RemoteUtils.js'

export const PAGE_TURNS = 100
// Safety limits: a cursor loop or a runaway server cannot make the bookmarklet spin forever
export const MAX_PAGES = 1000
export const MAX_MESSAGES = 200000
// Name of the query parameter that carries page_info.start_cursor to fetch the
// preceding page (taken from the community write-up; confirm in a live session)
const CURSOR_PARAM = 'before'

/**
 * Builds the paginated conversation URL.
 * @param {string} id - The conversation UUID.
 * @param {string|null} cursor - page_info.start_cursor of the previously fetched (newer) page.
 * @returns {string} The origin-relative URL.
 */
export function pagedUrl(id, cursor) {
	const base = `/backend-api/conversations/${id}?include_has_versions=true&num_turns=${PAGE_TURNS}`
	return cursor ? `${base}&${CURSOR_PARAM}=${encodeURIComponent(cursor)}` : base
}

/**
 * Follows page_info.start_cursor backwards until the first page of the
 * conversation, a repeated cursor, missing metadata or a safety limit.
 * @param {string} id - The conversation UUID.
 * @param {Object<string, string>} headers - Request headers (authorization).
 * @param {AbortSignal} [signal] - Cancels in-flight requests.
 * @returns {Promise<{pages: object[], warnings: string[], reachedStart: boolean|null}>}
 *          Pages newest first. reachedStart is true when the server reported no
 *          previous page, false when pagination stopped early, null when the
 *          first page carries no pagination metadata at all.
 */
export async function fetchPages(id, headers, signal) {
	const pages = []
	const warnings = []
	const cursors = new Set()
	let cursor = null
	let reachedStart = false
	for (let n = 0; ; n++) {
		if (n >= MAX_PAGES) {
			warnings.push(`Stopped after ${MAX_PAGES} pages (safety limit); older messages missing.`)
			break
		}
		const page = await apiGet(pagedUrl(id, cursor), headers, { signal })
		if (!page || typeof page !== 'object') {
			throw new Error('Conversation page is not an object')
		}
		pages.push(page)
		const info = page.page_info
		if (!info || typeof info !== 'object' || typeof info.has_previous_page !== 'boolean') {
			if (n === 0) {
				reachedStart = null
				warnings.push('The response has no pagination metadata; completeness unverified.')
			} else {
				warnings.push(`Page ${n + 1} has no pagination metadata.`)
				reachedStart = false
			}
			break
		}
		if (!info.has_previous_page) {
			reachedStart = true
			break
		}
		if (!info.start_cursor || typeof info.start_cursor !== 'string') {
			warnings.push(`Page ${n + 1} reports an older page but no start_cursor.`)
			break
		}
		if (cursors.has(info.start_cursor)) {
			warnings.push(`Pagination repeated cursor ${info.start_cursor} on page ${n + 1}.`)
			break
		}
		cursors.add(info.start_cursor)
		cursor = info.start_cursor
	}
	return { pages, warnings, reachedStart }
}

/**
 * Walks the active branch of a conversation tree from current_node to the root.
 * @param {object} mapping - The id → node map (nodes carry message and parent).
 * @param {string} currentNode - The id of the active leaf.
 * @param {string[]} warnings - Receives problems found while walking.
 * @returns {{messages: object[], rootReached: boolean}} The active branch in chat order, and whether the walk ended at the root.
 */
export function activeBranch(mapping, currentNode, warnings) {
	const chain = []
	const visited = new Set()
	let nodeId = currentNode
	let reachedRoot = false
	while (nodeId) {
		if (visited.has(nodeId)) {
			warnings.push(`Cycle in the conversation tree at node ${nodeId}.`)
			break
		}
		visited.add(nodeId)
		const node = mapping[nodeId]
		if (!node) {
			warnings.push(`Missing parent node ${nodeId}; export starts mid-conversation.`)
			break
		}
		if (node.message) chain.push(node.message)
		if (!node.parent) reachedRoot = true
		nodeId = node.parent
	}
	return { messages: chain.reverse(), rootReached: reachedRoot }
}

/**
 * Merges messages from several pages (oldest page first), removing duplicate
 * ids. When two records share an id but differ in content, the more recently
 * updated one wins and the conflict is reported.
 * @param {object[]} messages - Messages in chronological order, possibly with repeats.
 * @param {string[]} warnings - Receives conflicts.
 * @returns {{messages: object[], duplicates: number}}
 */
export function dedupeMessages(messages, warnings) {
	const index = new Map()
	const out = []
	let duplicates = 0
	for (const message of messages) {
		const id = message && message.id
		if (!id) {
			out.push(message)
			continue
		}
		if (!index.has(id)) {
			index.set(id, out.length)
			out.push(message)
			continue
		}
		duplicates++
		const at = index.get(id)
		const kept = out[at]
		if (JSON.stringify(kept.content) !== JSON.stringify(message.content)) {
			warnings.push(`Message ${id} appears twice with different content; the newer record was used.`)
			if ((message.update_time || 0) > (kept.update_time || 0)) out[at] = message
		}
	}
	return { messages: out, duplicates }
}

/**
 * Checks parent links recorded in message metadata (metadata.parent_id) for
 * cycles and for sibling versions, without treating unknown parents as errors:
 * parent_id may point at structural nodes that are not exported as messages.
 * @param {object[]} messages - Exported-candidate messages in chat order.
 * @param {string[]} warnings - Receives problems.
 */
function checkParentLinks(messages, warnings) {
	const known = new Set(messages.map((m) => m.id).filter(Boolean))
	const parentOf = new Map(messages.map((m) => [m.id, m.metadata && m.metadata.parent_id]))
	for (const id of known) {
		const seen = new Set([id])
		let p = parentOf.get(id)
		while (p && known.has(p)) {
			if (seen.has(p)) {
				warnings.push(`Cycle in parent links at message ${p}.`)
				return
			}
			seen.add(p)
			p = parentOf.get(p)
		}
	}
	const byParent = new Map()
	for (const m of messages) {
		const role = m.author && m.author.role
		const parent = m.metadata && m.metadata.parent_id
		if (!parent || (role !== 'user' && role !== 'assistant') || (m.metadata && m.metadata.is_visually_hidden_from_conversation)) continue
		const key = `${role}:${parent}`
		byParent.set(key, (byParent.get(key) || 0) + 1)
	}
	const siblings = [...byParent.values()].filter((n) => n > 1).length
	if (siblings) {
		warnings.push(`${siblings} message group(s) share a parent (alternate versions); the active one is unverified, so all are included.`)
	}
}

/**
 * Turns fetched pages into one chronological message list for the active branch.
 * @param {object[]} pages - Pages, newest first.
 * @param {string[]} warnings - Receives problems.
 * @returns {{messages: object[], duplicates: number, rootReached: boolean|null}} rootReached is
 *          true/false for tree payloads and null for message-list payloads.
 * @throws {Error} when the payload has neither a message list nor a tree, or the active leaf is unusable.
 */
export function resolveMessages(pages, warnings) {
	const newest = pages[0]
	if (Array.isArray(newest.messages)) {
		const chronological = []
		for (let i = pages.length - 1; i >= 0; i--) {
			if (Array.isArray(pages[i].messages)) {
				chronological.push(...pages[i].messages)
			} else {
				warnings.push(`Page ${i + 1} has no messages array; skipped.`)
			}
		}
		if (chronological.length > MAX_MESSAGES) {
			warnings.push(`More than ${MAX_MESSAGES} messages; the oldest were dropped.`)
			chronological.splice(0, chronological.length - MAX_MESSAGES)
		}
		const deduped = dedupeMessages(chronological, warnings)
		let messages = deduped.messages
		const current = newest.current_node
		if (!current) {
			warnings.push('The response names no current_node; active branch unverified.')
		} else {
			const at = messages.findIndex((m) => m.id === current)
			if (at < 0) {
				warnings.push(`current_node ${current} is not among the retrieved messages; active branch unverified.`)
			} else if (at < messages.length - 1) {
				warnings.push(`${messages.length - 1 - at} message(s) after current_node belong to another branch; left out.`)
				messages = messages.slice(0, at + 1)
			}
		}
		checkParentLinks(messages, warnings)
		return { messages, duplicates: deduped.duplicates, rootReached: null }
	}
	if (newest.mapping && typeof newest.mapping === 'object') {
		const mapping = {}
		for (let i = pages.length - 1; i >= 0; i--) Object.assign(mapping, pages[i].mapping)
		if (!newest.current_node || !mapping[newest.current_node]) {
			throw new Error('No usable current_node: active branch unresolved')
		}
		const branch = activeBranch(mapping, newest.current_node, warnings)
		return { messages: branch.messages, duplicates: 0, rootReached: branch.rootReached }
	}
	throw new Error('No messages array or mapping in the conversation')
}

/**
 * Retrieves a conversation: paginated endpoint first, then the legacy
 * single-document endpoint when the paginated one is unavailable.
 * @param {string} id - The conversation UUID.
 * @param {Object<string, string>} headers - Request headers (authorization).
 * @param {AbortSignal} [signal] - Cancels in-flight requests.
 * @returns {Promise<{endpoint: 'paged'|'legacy', title: string|undefined, defaultModel: string|undefined, messages: object[], warnings: string[], complete: boolean, stats: object}>}
 */
export async function fetchConversation(id, headers, signal) {
	let fetched
	try {
		fetched = await fetchPages(id, headers, signal)
	} catch (error) {
		if (signal && signal.aborted) throw error
		const page = await apiGet(`/backend-api/conversation/${id}`, headers, { signal })
		fetched = { pages: [page], warnings: [], reachedStart: true, legacy: true }
	}
	const warnings = fetched.warnings.slice()
	const resolved = resolveMessages(fetched.pages, warnings)
	const complete = fetched.reachedStart === true && resolved.rootReached !== false && !warnings.length
	return {
		endpoint: fetched.legacy ? 'legacy' : 'paged',
		title: fetched.pages[0].title,
		defaultModel: fetched.pages[0].default_model_slug,
		messages: resolved.messages,
		warnings,
		complete,
		stats: { pages: fetched.pages.length, messages: resolved.messages.length, duplicates: resolved.duplicates },
	}
}

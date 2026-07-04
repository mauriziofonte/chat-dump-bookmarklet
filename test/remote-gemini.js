/**
 * Verifies the Gemini remote (batchexecute RPC) extraction path with a mocked
 * fetch built from a real HAR capture: envelope decoding, cursor pagination,
 * newest-first reversal, chosen-candidate selection on regenerated responses,
 * attachment file name collection.
 */
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<body></body>', { url: 'https://gemini.google.com/app/0123456789abcdef' })
global.window = dom.window
global.document = dom.window.document
global.NodeFilter = dom.window.NodeFilter
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
dom.window.WIZ_global_data = { SNlM0e: 'at-token-123', cfb2h: 'boq_assistant-bard-web-server_test', FdrFJe: '-42' }

const CID = 'c_0123456789abcdef'
const attach = [[null, null, null, null, [[null, 11, 'Sample_Guide.pdf', null, null, '$AQbNOISE']]]]
// Turn records as served by hNvQHb (newest first)
const turnNew = [
	[CID, 'r_new'],
	[CID, 'r_old', 'rc_old_chosen'],
	[['Second question', null, null, null, null]],
	[[['rc_new', ['Second answer with **bold**.']]]],
	[1770564030, 0],
]
const turnOld = [
	[CID, 'r_old'],
	[CID, 'r_root', 'rc_root'],
	[['First question', null, null, null, attach]],
	[
		[
			['rc_old_draft', ['WRONG abandoned draft']],
			['rc_old_chosen', ['First answer, chosen draft.']],
		],
	],
	[1770500417, 0],
]

const envelope = (payload) => `)]}'\n\n123\n${JSON.stringify([['wrb.fr', 'hNvQHb', JSON.stringify(payload), null, null, null, 'generic']])}`
const page1 = envelope([[turnNew], 'CURSOR-1', null, []])
const page2 = envelope([[turnOld], null, null, []])

const requests = []
global.fetch = async (url, opts) => {
	if (!String(url).startsWith('/_/BardChatUi/data/batchexecute')) {
		return { ok: false, status: 404 }
	}
	const body = decodeURIComponent((opts.body.match(/f\.req=([^&]+)/) || [])[1] || '')
	requests.push({ url: String(url), raw: opts.body, body })
	const text = requests.length === 1 ? page1 : page2
	return { ok: true, status: 200, text: async () => text }
}
dom.window.fetch = global.fetch

const { default: GeminiParser } = await import('../src/Parsers/GeminiParser.js')
const { processConversations } = await import('../src/ConversationProcessor.js')
const { formatAsMarkdown } = await import('../src/OutputFormatter.js')

const remote = await GeminiParser.parseRemote()
const checks = []
const check = (label, cond) => {
	checks.push([label, cond])
	console.log(`${cond ? 'PASS' : 'FAIL'}: ${label}`)
}

check('two RPC pages requested', requests.length === 2)
check('at token sent', requests[0].raw.includes('at=at-token-123'))
check('conversation id in f.req', requests[0].body.includes(CID))
check('cursor forwarded on page 2', requests[1].body.includes('CURSOR-1'))
check('4 items extracted', remote && remote.items.length === 4)

const md = formatAsMarkdown(processConversations(remote.items), 'Gemini test')
check('chronological order restored', md.indexOf('First question') < md.indexOf('Second question'))
check('chosen draft picked, abandoned excluded', md.includes('First answer, chosen draft.') && !md.includes('WRONG abandoned draft'))
check('attachment collected, noise excluded', md.includes('Sample_Guide.pdf') && !md.includes('$AQbNOISE'))
check('second answer present', md.includes('Second answer with **bold**.'))

if (checks.some(([, cond]) => !cond)) {
	process.exit(1)
}
console.log('remote-gemini: all checks passed')

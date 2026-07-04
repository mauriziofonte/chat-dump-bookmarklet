/**
 * Verifies the ChatGPT remote (API-based) extraction path with a mocked
 * same-origin fetch: session token retrieval, active-branch linearization
 * from the conversation tree (branched mapping), merging of consecutive
 * assistant nodes, code fencing, attachments, hidden-message exclusion.
 */
import { JSDOM } from 'jsdom'

const CONV_ID = '11111111-2222-3333-4444-555555555555'

const dom = new JSDOM('<body></body>', { url: `https://chatgpt.com/c/${CONV_ID}` })
global.window = dom.window
global.document = dom.window.document
global.NodeFilter = dom.window.NodeFilter
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })

const msg = (id, parent, children, message) => ({ id, parent, children, message })
const conversation = {
	title: 'GPT test conversation',
	current_node: 'n6',
	mapping: {
		root: msg('root', null, ['n1'], null),
		n1: msg('n1', 'root', ['n2', 'n2-abandoned'], {
			author: { role: 'user' },
			content: { content_type: 'text', parts: ['First question'] },
			metadata: { attachments: [{ name: 'data.csv' }] },
		}),
		// abandoned branch: must NOT appear in the export
		'n2-abandoned': msg('n2-abandoned', 'n1', [], {
			author: { role: 'assistant' },
			content: { content_type: 'text', parts: ['OLD ANSWER from abandoned branch'] },
		}),
		n2: msg('n2', 'n1', ['n3'], {
			author: { role: 'assistant' },
			content: { content_type: 'text', parts: ['Answer part one.'] },
		}),
		n3: msg('n3', 'n2', ['n4'], {
			author: { role: 'assistant' },
			content: { content_type: 'code', language: 'python', text: 'print(42)' },
		}),
		n4: msg('n4', 'n3', ['n5'], {
			author: { role: 'system' },
			content: { content_type: 'text', parts: ['system noise'] },
			metadata: { is_visually_hidden_from_conversation: true },
		}),
		n5: msg('n5', 'n4', ['n6'], {
			author: { role: 'user' },
			content: { content_type: 'text', parts: ['Second question'] },
		}),
		n6: msg('n6', 'n5', [], {
			author: { role: 'assistant' },
			content: { content_type: 'text', parts: ['Second answer'] },
		}),
	},
}

const routes = {
	'/api/auth/session': { accessToken: 'tok-123' },
	[`/backend-api/conversation/${CONV_ID}`]: conversation,
}
let bearerSeen = null
global.fetch = async (path, opts) => {
	if (path.startsWith('/backend-api/')) {
		bearerSeen = opts && opts.headers && opts.headers.authorization
	}
	if (!routes[path]) return { ok: false, status: 404 }
	return { ok: true, status: 200, json: async () => routes[path] }
}
dom.window.fetch = global.fetch

const { default: ChatGPTParser } = await import('../src/Parsers/ChatGPTParser.js')
const { processConversations } = await import('../src/ConversationProcessor.js')
const { formatAsMarkdown } = await import('../src/OutputFormatter.js')

const remote = await ChatGPTParser.parseRemote()
const checks = []
const check = (label, cond) => {
	checks.push([label, cond])
	console.log(`${cond ? 'PASS' : 'FAIL'}: ${label}`)
}

check('bearer token sent', bearerSeen === 'Bearer tok-123')
check('4 items (2 prompts + 2 merged responses)', remote && remote.items.length === 4)
check('title from API', remote.title === 'GPT test conversation')

const md = formatAsMarkdown(processConversations(remote.items), remote.title)
check('assistant nodes merged into one response', md.includes('Answer part one.') && md.includes('```python\nprint(42)\n```'))
check('abandoned branch excluded', !md.includes('OLD ANSWER'))
check('hidden system message excluded', !md.includes('system noise'))
check('attachment listed', md.includes('data.csv'))
check('second turn present', md.includes('Second question') && md.includes('Second answer'))

if (checks.some(([, cond]) => !cond)) {
	process.exit(1)
}
console.log('remote-chatgpt: all checks passed')

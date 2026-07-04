/**
 * Verifies the Claude remote (API-based) extraction path with a mocked
 * same-origin fetch: full turn coverage (beyond DOM virtualization),
 * attachments with extracted content, artifact sources, tool markers,
 * and both Markdown and HTML outputs.
 */
import { JSDOM } from 'jsdom'

const CONV_ID = '11111111-2222-3333-4444-555555555555'
const ORG_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

const dom = new JSDOM('<body></body>', { url: `https://claude.ai/chat/${CONV_ID}` })
global.window = dom.window
global.document = dom.window.document
global.NodeFilter = dom.window.NodeFilter
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })

const conversation = {
	name: 'Test conversation',
	chat_messages: [
		{
			sender: 'human',
			content: [{ type: 'text', text: 'Analyze this PRD, please.' }],
			attachments: [{ file_name: 'PRD_v1.md', extracted_content: '# PRD\n\nFull attached document body.' }],
			files: [{ file_name: 'screenshot-1.png' }],
		},
		{
			sender: 'assistant',
			content: [
				{ type: 'text', text: 'Here is my analysis.\n\n## Analysis section\n\nDetails.' },
				{ type: 'thinking', thinking: 'secret reasoning that must NOT leak' },
				{ type: 'tool_use', name: 'web_search', input: { query: 'PRD best practices' } },
				{ type: 'tool_use', name: 'artifacts', input: { command: 'create', title: 'parser.py', language: 'python', content: 'print("hi")' } },
				{ type: 'text', text: 'Done. See the artifact above.' },
			],
		},
		{ sender: 'human', content: [{ type: 'text', text: 'Thanks!' }] },
		{ sender: 'assistant', content: [{ type: 'text', text: 'Anytime.' }] },
	],
}

const routes = {
	'/api/organizations': [{ uuid: ORG_ID }],
	[`/api/organizations/${ORG_ID}/chat_conversations/${CONV_ID}?tree=True&rendering_mode=messages&render_all_tools=true`]: conversation,
}
global.fetch = async (path) => {
	if (!routes[path]) return { ok: false, status: 404 }
	return { ok: true, status: 200, json: async () => routes[path] }
}
dom.window.fetch = global.fetch

const { default: ClaudeParser } = await import('../src/Parsers/ClaudeParser.js')
const { processConversations } = await import('../src/ConversationProcessor.js')
const { formatAsMarkdown, formatAsHtml } = await import('../src/OutputFormatter.js')

const remote = await ClaudeParser.parseRemote()
const checks = []
const check = (label, cond) => {
	checks.push([label, cond])
	console.log(`${cond ? 'PASS' : 'FAIL'}: ${label}`)
}

check('remote returns 4 items', remote && remote.items.length === 4)
check('title from API', remote.title === 'Test conversation')

const items = processConversations(remote.items)
const md = formatAsMarkdown(items, remote.title)
const html = formatAsHtml(items, remote.title)

check('response headings demoted below turn level', md.includes('### Analysis section') && !md.includes('\n## Analysis section'))
check('fenced attachment headings untouched', md.includes('# PRD') && !md.includes('### PRD'))
check('provenance preamble present', md.includes('[ChatDump](https://github.com/mauriziofonte/chat-dump-bookmarklet)') && md.includes(CONV_ID))

check('markdown has all 4 turns', md.includes('Human Prompt 1') && md.includes('LLM Response 2'))
check('attachment names listed', md.includes('PRD_v1.md') && md.includes('screenshot-1.png'))
check('attachment content preserved', md.includes('Full attached document body.'))
check('artifact marker + source', md.includes('[Artifact: parser.py]') && md.includes('```python\nprint("hi")\n```'))
check('tool marker with query', md.includes('[Tool: web_search — PRD best practices]'))
check('thinking excluded', !md.includes('secret reasoning'))
check('html has code block', html.includes('<pre><code class="language-python">print(&quot;hi&quot;)</code></pre>'))
check('html has headers', html.includes('<h2>Human Prompt 1</h2>') && html.includes('<h2>LLM Response 2</h2>'))
check('html attachments line', html.includes('PRD_v1.md'))

if (checks.some(([, cond]) => !cond)) {
	process.exit(1)
}
console.log('remote-claude: all checks passed')

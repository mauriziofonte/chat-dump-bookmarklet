import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mockFetch, exportAll, loadClaudeFixture, claudeRoutes, CLAUDE_ID } from './helpers.mjs'

const url = `https://claude.ai/chat/${CLAUDE_ID}`
const run = (mutate) =>
	exportAll(() => {
		const data = loadClaudeFixture()
		if (mutate) mutate(data)
		mockFetch(claudeRoutes(data))
	}, url)

test('Claude fixture: content, exclusions, attachments, artifacts and tool markers', async () => {
	const { md } = await run()
	assert.match(md, /^# Parser review <b>draft<\/b>\n/)
	assert.match(md, /## Human Prompt 1[\s\S]*Review this spec/)
	assert.match(md, /> \[Attachments: spec_v2\.md, <img src=x onerror=alert\(1\)>\.png\]/)
	assert.match(md, /> \[Attachment: spec_v2\.md\]\n\n```\n# Spec\n\nAttached body text\.\n```/)
	assert.match(md, /### Findings/) // headings demoted below the turn headers
	assert.match(md, /\| Parser \| ok \|/)
	assert.match(md, /> \[Tool: web_search — markdown table syntax\]/)
	assert.match(md, /> \[Artifact: fix\.py\]\n\n```python\ndef fix\(\):\n {4}return 1\n```/)
	assert.doesNotMatch(md, /PRIVATE REASONING|RAW TOOL RESULT/)
})

test('Claude fixture: user text and code containing citation-like markers stay literal', async () => {
	const { md } = await run()
	assert.match(md, /print\('genui\{"citation":\{"ref":"literal"\}\}'\)/)
	assert.doesNotMatch(md, /Citation unresolved/)
})

test('Claude fixture: metadata, per-response models and completion times', async () => {
	const { md } = await run()
	assert.match(md, /- Models: claude-model-a, claude-model-b\n- Conversation default model: claude-conversation-default\n/)
	assert.match(md, /> Created: 2026-09-30T08:00:05\.000Z · Model: claude-model-a · Completed: 2026-09-30T08:00:45\.250Z · Last updated: 2026-09-30T08:00:50\.000Z/)
	assert.match(md, /> Created: 2026-09-30T08:05:02\.000Z · Model: claude-model-b · Completed: 2026-09-30T08:05:19\.000Z · Last updated: 2026-09-30T08:05:20\.000Z/)
})

test('Claude fixture: HTML export escapes the title and attachment names', async () => {
	const { html } = await run()
	assert.match(html, /<h1>Parser review &lt;b&gt;draft&lt;\/b&gt;<\/h1>/)
	assert.doesNotMatch(html, /<img src=x|<b>draft/)
	assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;\.png/)
	assert.match(html, /<pre><code class="language-python">def fix\(\):/)
})

test('Claude: no completeness claim is made for the unpaginated API', async () => {
	const { md, toast } = await run()
	assert.doesNotMatch(md, /Export notice/)
	assert.doesNotMatch(toast, /incomplete/i)
})

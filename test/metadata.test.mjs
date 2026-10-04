import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { mockFetch, loadPagedFixture, splitPages, pagedRoutes, exportAll } from './helpers.mjs'
import { toIso, latestIso, modelId } from '../src/Metadata.js'

const gpt = (mutate) => async (dom) => {
	const full = loadPagedFixture()
	if (mutate) mutate(full)
	mockFetch(pagedRoutes(splitPages(full, [12])))
}
const claudeOrg = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const claudeId = '11111111-2222-3333-4444-555555555555'
const claude = (conversation) => () =>
	mockFetch({
		'/api/organizations': [{ uuid: claudeOrg }],
		[`/api/organizations/${claudeOrg}/chat_conversations/${claudeId}?tree=True&rendering_mode=messages&render_all_tools=true`]: conversation,
	})

test('toIso / latestIso / modelId normalize and reject bad input', () => {
	assert.equal(toIso(1700000000.125), '2023-11-14T22:13:20.125Z')
	assert.equal(toIso('2024-05-06T07:08:09+02:00'), '2024-05-06T05:08:09.000Z')
	assert.equal(toIso(null), null)
	assert.equal(toIso('garbage'), null)
	assert.equal(latestIso([null, '2026-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z']), '2026-01-01T00:00:00.000Z')
	assert.equal(latestIso([null]), null)
	assert.equal(modelId(' gpt-x '), 'gpt-x')
	assert.equal(modelId({}), null)
})

test('synthetic fixture: header model, ISO creation times, export time, completion unknown', async () => {
	mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-04T12:00:00.000Z') })
	let out
	try {
		out = await exportAll(gpt())
	} finally {
		mock.timers.reset()
	}
	assert.match(out.md, /\n- Models: test-model-alpha\n- Exported: 2026-10-04T12:00:00\.000Z\n/)
	// prompt: creation only; response: model, completion unknown, last update separate
	assert.match(out.md, /## Human Prompt 1\n\n> Created: 2023-11-14T22:13:20\.125Z\n\nWhich gasket size fits/)
	assert.match(out.md, /## LLM Response 1\n\n> Created: 2023-11-14T22:13:22\.250Z · Model: test-model-alpha · Completed: unknown · Last updated: 2023-11-14T22:13:35\.750Z\n\n/)
	assert.match(out.md, /## LLM Response 2\n\n> Created: 2023-11-14T22:15:02\.750Z · Model: test-model-alpha · Completed: unknown · Last updated: 2023-11-15T09:20:00\.250Z\n/)
	assert.match(out.html, /<li>Models: test-model-alpha<\/li><li>Exported: 2026-10-04T12:00:00\.000Z<\/li>/)
	assert.match(out.html, /<h2>Human Prompt 1<\/h2>\n<p><em>Created: 2023-11-14T22:13:20\.125Z<\/em><\/p>/)
	assert.match(out.txt, /Models: test-model-alpha\nExported: 2026-10-04T12:00:00\.000Z\n/)
	assert.match(out.txt, /Created: 2023-11-14T22:13:22\.250Z · Model: test-model-alpha · Completed: unknown/)
})

test('models that vary between responses are kept per response and listed in the header', async () => {
	const out = await exportAll(
		gpt((full) => {
			for (const m of full.messages.slice(6)) if (m.metadata.model_slug) m.metadata.model_slug = 'internal-model-b'
		}),
	)
	assert.match(out.md, /- Models: test-model-alpha, internal-model-b\n/)
	assert.match(out.md, /## LLM Response 1\n\n> Created: [^\n]* · Model: test-model-alpha ·/)
	assert.match(out.md, /## LLM Response 2\n\n> Created: [^\n]* · Model: internal-model-b ·/)
})

test('missing values are marked unknown; nothing is inferred', async () => {
	const out = await exportAll(
		gpt((full) => {
			delete full.default_model_slug
			for (const m of full.messages) {
				delete m.create_time
				delete m.update_time
				delete m.metadata.model_slug
			}
		}),
	)
	assert.match(out.md, /- Models: unknown\n/)
	assert.match(out.md, /## Human Prompt 1\n\n> Created: unknown\n/)
	assert.match(out.md, /> Created: unknown · Model: unknown · Completed: unknown · Last updated: unknown\n/)
})

test('conversation default model is shown separately when it differs, never as a response model', async () => {
	const out = await exportAll(gpt((full) => (full.default_model_slug = 'default-x')))
	assert.match(out.md, /- Models: test-model-alpha\n- Conversation default model: default-x\n/)
})

test('model identifiers are escaped in HTML and single-line in Markdown', async () => {
	const out = await exportAll(
		gpt((full) => {
			for (const m of full.messages) if (m.metadata.model_slug) m.metadata.model_slug = '<img src=x onerror=1>'
		}),
	)
	assert.doesNotMatch(out.html, /<img src=x/)
	assert.match(out.html, /Models: &lt;img src=x onerror=1&gt;/)
})

test('Claude: per-message timestamps, completion from stop_timestamp, own model only', async () => {
	const out = await exportAll(
		claude({
			name: 'Claude chat',
			model: 'claude-conv-level',
			chat_messages: [
				{ sender: 'human', created_at: '2026-10-01T10:00:00.000000+00:00', updated_at: '2026-10-01T10:00:00.000000+00:00', content: [{ type: 'text', text: 'Question' }] },
				{
					sender: 'assistant',
					model: 'claude-own-model',
					created_at: '2026-10-01T10:00:05.000000+00:00',
					updated_at: '2026-10-01T10:01:00.000000+00:00',
					content: [
						{ type: 'text', text: 'Part one', start_timestamp: '2026-10-01T10:00:05.100Z', stop_timestamp: '2026-10-01T10:00:20.000Z' },
						{ type: 'text', text: 'Part two', start_timestamp: '2026-10-01T10:00:21.000Z', stop_timestamp: '2026-10-01T10:00:40.500Z' },
					],
				},
				{ sender: 'human', content: [{ type: 'text', text: 'No metadata' }] },
				{ sender: 'assistant', content: [{ type: 'text', text: 'Answer without metadata' }] },
			],
		}),
		`https://claude.ai/chat/${claudeId}`,
	)
	assert.match(out.md, /- Models: claude-own-model\n- Conversation default model: claude-conv-level\n/)
	assert.match(out.md, /## Human Prompt 1\n\n> Created: 2026-10-01T10:00:00\.000Z\n/)
	assert.match(out.md, /> Created: 2026-10-01T10:00:05\.000Z · Model: claude-own-model · Completed: 2026-10-01T10:00:40\.500Z · Last updated: 2026-10-01T10:01:00\.000Z\n/)
	assert.match(out.md, /## Human Prompt 2\n\n> Created: unknown\n/)
	assert.match(out.md, /## LLM Response 2\n\n> Created: unknown · Model: unknown · Completed: unknown · Last updated: unknown\n/)
})

test('DOM fallback has no per-turn metadata and states that models are unknown', async () => {
	const out = await exportAll((dom) => {
		mockFetch({})
		dom.window.document.body.innerHTML = '<section data-turn="user"><div class="whitespace-pre-wrap">Q</div></section><section data-turn="assistant"><div class="markdown"><p>A</p></div></section>'
	})
	assert.match(out.md, /- Models: unknown\n- Exported: \d{4}-\d\d-\d\dT[\d:.]+Z\n/)
	assert.doesNotMatch(out.md, /> Created:/)
})

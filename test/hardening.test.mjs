import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { installDom } from './helpers.mjs'

const ID = '11111111-2222-3333-4444-555555555555'

test('platform detection requires HTTPS and an exact hostname', async () => {
	const { getPlatformParser } = await import('../src/ParserFactory.js')
	const parserFor = (url) => {
		installDom(url)
		return getPlatformParser()
	}
	assert.equal(parserFor(`https://chatgpt.com/c/${ID}`).name, 'chatgpt')
	assert.equal(parserFor(`https://chat.openai.com/c/${ID}`).name, 'chatgpt')
	assert.equal(parserFor(`https://claude.ai/chat/${ID}`).name, 'claude')
	assert.equal(parserFor('https://gemini.google.com/app/abc').name, 'gemini')
	assert.equal(parserFor('https://chatgpt.com.attacker.invalid/'), null)
	assert.equal(parserFor('https://claude.ai.attacker.invalid/'), null)
	assert.equal(parserFor('https://notchatgpt.com/'), null)
	assert.equal(parserFor('http://chatgpt.com/'), null)
})

test('apiFetch rejects non-relative paths and sends redirect:error', async () => {
	installDom('https://chatgpt.com/')
	const { apiFetch } = await import('../src/RemoteUtils.js')
	let init
	global.fetch = async (p, i) => ((init = i), { ok: true, status: 200, redirected: false, url: 'https://chatgpt.com' + p, json: async () => ({}) })
	for (const bad of ['https://evil.example/x', '//evil.example/x', 'api/x', '/\\evil.example']) {
		await assert.rejects(() => apiFetch(bad), /non-relative/)
	}
	await apiFetch('/api/x')
	assert.equal(init.redirect, 'error')
	assert.equal(init.credentials, 'same-origin')
})

test('apiFetch rejects redirected responses and foreign origins', async () => {
	installDom('https://chatgpt.com/')
	const { apiFetch } = await import('../src/RemoteUtils.js')
	global.fetch = async () => ({ ok: true, status: 200, redirected: true, url: 'https://chatgpt.com/other' })
	await assert.rejects(() => apiFetch('/api/x'), /redirected/)
	global.fetch = async () => ({ ok: true, status: 200, redirected: false, url: 'https://evil.example/x' })
	await assert.rejects(() => apiFetch('/api/x'), /left the page origin/)
	global.fetch = async () => ({ ok: false, status: 500, redirected: false, url: 'https://chatgpt.com/api/x' })
	await assert.rejects(() => apiFetch('/api/x'), /returned 500/)
})

test('apiFetch cancels the underlying request on timeout and on caller abort', async () => {
	installDom('https://chatgpt.com/')
	const { apiFetch } = await import('../src/RemoteUtils.js')
	let seen
	global.fetch = (p, init) =>
		new Promise((resolve, reject) => {
			seen = init.signal
			init.signal.addEventListener('abort', () => reject(new Error('aborted')))
		})
	await assert.rejects(() => apiFetch('/api/slow', {}, { timeoutMs: 20 }), /timed out/)
	assert.equal(seen.aborted, true)

	const controller = new AbortController()
	const pending = apiFetch('/api/slow2', {}, { signal: controller.signal, timeoutMs: 5000 })
	controller.abort()
	await assert.rejects(() => pending, /aborted/)
	assert.equal(seen.aborted, true)
})

test('Blob URLs are revoked when the toast is replaced or dismissed', async () => {
	installDom('https://claude.ai/')
	global.requestAnimationFrame = (cb) => cb()
	let n = 0
	const revoked = []
	window.URL.createObjectURL = () => `blob:fake-${n++}`
	window.URL.revokeObjectURL = (u) => revoked.push(u)
	global.URL.createObjectURL = window.URL.createObjectURL
	global.URL.revokeObjectURL = window.URL.revokeObjectURL
	mock.timers.enable({ apis: ['setTimeout'] })
	try {
		const { initUI, showExportOptions, showError } = await import('../src/UIManager.js')
		initUI()
		const opts = { mdText: '#', htmlText: '<p>', txtText: 't', filename: 'f' }

		showExportOptions(opts) // blob-0..2
		showExportOptions(opts) // replaces: first three scheduled
		assert.deepEqual(revoked, [], 'revocation waits for pending downloads')
		mock.timers.tick(30000)
		assert.deepEqual(revoked, ['blob:fake-0', 'blob:fake-1', 'blob:fake-2'])

		document.querySelector('.toast-close').click() // dismiss second set
		mock.timers.tick(30000)
		assert.deepEqual(revoked.slice(3), ['blob:fake-3', 'blob:fake-4', 'blob:fake-5'])

		showExportOptions(opts) // blob-6..8
		showError('x') // replaced by another toast
		mock.timers.tick(30000)
		assert.equal(revoked.length, 9)
		assert.equal(new Set(revoked).size, 9, 'no URL is revoked twice')
	} finally {
		mock.timers.reset()
	}
})

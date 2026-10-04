/** The build stores spaces of the message tables as '~'; translations must come out identical. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as esbuild from 'esbuild'
import { i18nSpaces } from '../bundle.js'
import { installDom } from './helpers.mjs'

const source = readFileSync(new URL('../src/I18n.js', import.meta.url), 'utf8')

test('no message value contains the space sentinel', () => {
	const values = [...source.matchAll(/^\t\t[a-z_]+: '(.*)',$/gm)].map((m) => m[1])
	assert.ok(values.length > 100)
	assert.ok(values.every((v) => !v.includes('~')))
})

test('built t() returns the same text as the source t() for every locale and key', async () => {
	const built = await esbuild.build({ entryPoints: ['src/I18n.js'], bundle: true, format: 'esm', write: false, plugins: [i18nSpaces] })
	const url = 'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
	const builtI18n = await import(url)
	const srcI18n = await import('../src/I18n.js')
	const keys = [...new Set([...source.matchAll(/^\t\t([a-z_]+): '/gm)].map((m) => m[1]))]
	let spacesRestored = 0
	for (const lang of ['en', 'zh', 'hi', 'es', 'fr', 'ar', 'bn', 'pt', 'ru', 'ur', 'it']) {
		installDom('https://claude.ai/')
		Object.defineProperty(global.navigator, 'language', { value: lang, configurable: true })
		for (const key of keys) {
			const expected = srcI18n.t(key, { n: 1, list: 'a b', format: 'F', tool: 'T', date: 'D', url: 'U' })
			assert.equal(builtI18n.t(key, { n: 1, list: 'a b', format: 'F', tool: 'T', date: 'D', url: 'U' }), expected, `${lang}.${key}`)
			if (expected.includes(' ')) spacesRestored++
		}
	}
	assert.ok(spacesRestored > 100)
})

test('the committed bookmarklet carries the translations with sentinel spaces', () => {
	const built = decodeURIComponent(readFileSync(new URL('../dist/chatdump.bookmarklet.js', import.meta.url), 'utf8').slice('javascript:'.length))
	assert.match(built, /save_md:"Save~as~MD"/)
})

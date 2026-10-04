import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { encodeBookmarklet } from '../encode.js'

test('encoding round-trips and leaves no URL- or attribute-unsafe characters', () => {
	const src = 'void (()=>{const a="x y<z>#%`\\u00e8\\\\";return [1,{b:a|2}]})()\n日本 😀'
	const url = encodeBookmarklet(src)
	assert.ok(url.startsWith('javascript:'))
	assert.equal(decodeURIComponent(url.slice('javascript:'.length)), src)
	// raw spaces are dropped by Safari when pasting a javascript: URL ("Unexpected token '{'")
	assert.doesNotMatch(url, /[#<>]|[^\x21-\x7e]/)
	assert.ok(url.includes('x%20y'))
	assert.doesNotMatch(url, /%(?![0-9A-F]{2})/)
})

test('the committed bookmarklet is a safe, decodable javascript: URL', () => {
	const built = readFileSync(new URL('../dist/chatdump.bookmarklet.js', import.meta.url), 'utf8')
	assert.doesNotMatch(built, /[#<>]|[^\x21-\x7e]/, 'no whitespace, non-ASCII or HTML-unsafe characters')
	assert.doesNotMatch(built, /%(?![0-9A-F]{2})/)
	assert.match(decodeURIComponent(built.slice('javascript:'.length)), /^void \(/)
})

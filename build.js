#!/usr/bin/env node
/**
 * Builds dist/chatdump.bookmarklet.js. With --check, nothing is written: the
 * committed file must equal a fresh build (exit 1 otherwise). Both modes
 * print the SHA-256 of the bookmarklet.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { bundle, MAX_BYTES } from './bundle.js'

const OUT = 'dist/chatdump.bookmarklet.js'
const check = process.argv.includes('--check')

const { bookmarklet, rawBytes } = await bundle()
const size = Buffer.byteLength(bookmarklet)
const sha = createHash('sha256').update(bookmarklet).digest('hex')

if (check) {
	const committed = readFileSync(OUT, 'utf8')
	const same = committed === bookmarklet
	console.log(`${same ? 'OK' : 'MISMATCH'}: ${OUT} ${same ? 'reproduces from source' : 'differs from a fresh build'} (sha256 ${sha})`)
	process.exit(same ? 0 : 1)
}

writeFileSync(OUT, bookmarklet)
console.log(`Bookmarklet: ${size} bytes (raw JS: ${rawBytes} bytes, limit: ${MAX_BYTES}), sha256 ${sha}`)
if (size > MAX_BYTES) {
	console.error(`ERROR: bookmarklet exceeds the ${MAX_BYTES}-byte limit`)
	process.exit(1)
}

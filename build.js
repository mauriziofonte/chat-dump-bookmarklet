#!/usr/bin/env node
import * as esbuild from 'esbuild'
import { writeFileSync } from 'node:fs'

// Browser bookmarklet hard limit (URL length): keep the encoded build below this.
const MAX_BYTES = 62 * 1024

const result = await esbuild.build({
	bundle: true,
	entryPoints: ['index.js'],
	format: 'iife',
	legalComments: 'none',
	minify: true,
	outfile: 'dist/chatdump.bookmarklet.js',
	sourcemap: false,
	// The chat platforms themselves require evergreen browsers: no point
	// transpiling below what claude.ai/chatgpt.com/gemini already demand.
	target: ['chrome90', 'firefox88', 'safari14', 'edge90'],
	write: false,
})

const js = result.outputFiles.find((f) => f.path.endsWith('.js'))
const bookmarklet = encodeURI('javascript:void ' + js.text)
writeFileSync(js.path, bookmarklet)

const size = Buffer.byteLength(bookmarklet)
console.log(`Bookmarklet: ${size} bytes (raw JS: ${Buffer.byteLength(js.text)} bytes, limit: ${MAX_BYTES})`)
if (size > MAX_BYTES) {
	console.error(`ERROR: bookmarklet exceeds the ${MAX_BYTES}-byte limit`)
	process.exit(1)
}

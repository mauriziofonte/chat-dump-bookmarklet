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
	target: ['chrome58', 'firefox57', 'safari11', 'edge16'],
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

#!/usr/bin/env node
import * as esbuild from 'esbuild'
import bookmarkletPlugin from 'esbuild-plugin-bookmarklet'

await esbuild.build({
	bundle: true,
	entryPoints: ['index.js'],
	format: 'iife',
	minify: true,
	outfile: 'dist/chatdump.bookmarklet.js',
	plugins: [bookmarkletPlugin],
	sourcemap: false,
	target: ['chrome58', 'firefox57', 'safari11', 'edge16'],
	write: false,
})

/**
 * The one definition of how dist/chatdump.bookmarklet.js is produced; shared
 * by build.js and the reproducibility test so they cannot drift apart.
 */
import * as esbuild from 'esbuild'
import { readFile } from 'node:fs/promises'
import { encodeBookmarklet } from './encode.js'

// Browser bookmarklet hard limit (URL length): keep the encoded build below this.
export const MAX_BYTES = 62 * 1024

/**
 * Rewrites the spaces inside the message-table values of src/I18n.js to '~'
 * (t() turns them back). A space costs 3 bytes in the percent-encoded
 * bookmarklet URL, a '~' one; the tables hold over 500 of them.
 */
export const i18nSpaces = {
	name: 'i18n-spaces',
	setup(build) {
		build.onLoad({ filter: /src[\\/]I18n\.js$/ }, async (args) => {
			const text = await readFile(args.path, 'utf8')
			const contents = text.replace(/^(\t\t[a-z_]+: ')(.*)(',)$/gm, (m, head, value, tail) => head + value.replace(/ /g, '~') + tail)
			return { contents, loader: 'js' }
		})
	},
}

/**
 * Bundles index.js and returns the javascript: URL.
 * @returns {Promise<{bookmarklet: string, rawBytes: number}>}
 */
export async function bundle() {
	const result = await esbuild.build({
		bundle: true,
		entryPoints: ['index.js'],
		format: 'iife',
		legalComments: 'none',
		minify: true,
		// Never write a file here: the caller decides. Output path is only used for type detection.
		outfile: 'dist/chatdump.bookmarklet.js',
		sourcemap: false,
		// The chat platforms themselves require evergreen browsers: no point
		// transpiling below what claude.ai/chatgpt.com/gemini already demand.
		target: ['chrome90', 'firefox88', 'safari14', 'edge90'],
		write: false,
		plugins: [i18nSpaces],
	})
	const js = result.outputFiles.find((f) => f.path.endsWith('.js')).text
	return { bookmarklet: encodeBookmarklet('void ' + js), rawBytes: Buffer.byteLength(js) }
}

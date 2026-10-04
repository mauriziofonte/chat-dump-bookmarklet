/**
 * Encodes bookmarklet source into a javascript: URL for pasting into the URL
 * field of a browser bookmark. Only characters that would corrupt the URL are
 * percent-encoded: spaces (Safari silently drops raw spaces from a pasted
 * javascript: URL, so `return {` becomes `return{` and `new Map` becomes `newMap`;
 * the build failed there with "Unexpected token '{'"), %, # (fragment start),
 * < and > (HTML embedding), and control characters including newlines. Quotes,
 * backslashes, braces and brackets stay raw, which Firefox, Chromium and Safari
 * accept in bookmark URLs; encodeURI would escape them and add ~14KB to the
 * 62KB budget. The source is expected
 * to be ASCII (esbuild escapes non-ASCII as \uXXXX); any other character is
 * encoded as UTF-8.
 * decodeURIComponent(encodeBookmarklet(x).slice('javascript:'.length)) === x.
 * @param {string} source - The minified JavaScript.
 * @returns {string} The javascript: URL.
 */
export function encodeBookmarklet(source) {
	const raw = /[\x21-\x7e]/
	const unsafe = /[ %#<>]/
	return 'javascript:' + Array.from(source, (ch) => (raw.test(ch) && !unsafe.test(ch) ? ch : encodeURIComponent(ch))).join('')
}

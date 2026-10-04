import '../types.js'
import ChatGPTParser from './Parsers/ChatGPTParser.js'
import GeminiParser from './Parsers/GeminiParser.js'
import ClaudeParser from './Parsers/ClaudeParser.js'

/** @type {ParserModule[]} */
const parsers = [ChatGPTParser, GeminiParser, ClaudeParser]

/**
 * Finds and returns the appropriate parser for the current website.
 * @returns {ParserModule|null} The matching parser module or null if none match.
 */
export function getPlatformParser() {
	// Exact hostnames over HTTPS only: substring matching accepted look-alike
	// hosts such as chatgpt.com.attacker.invalid
	if (window.location.protocol !== 'https:') {
		return null
	}
	const hostname = window.location.hostname.toLowerCase()
	return parsers.find((parser) => parser.matches(hostname)) || null
}

/**
 * Gets a list of supported platform names.
 * @returns {string[]} An array of supported platform names.
 */
export function getSupportedPlatforms() {
	return parsers.map((p) => p.name)
}

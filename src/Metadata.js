/**
 * Message and conversation metadata: original timestamps (ISO 8601, UTC) and
 * recorded model identifiers. Values the payload does not provide stay
 * null and are rendered as "unknown"; nothing is inferred, and internal
 * model identifiers are never translated into public model names.
 */
import { t } from './I18n.js'
import { escapeHtml, oneLine } from './Html.js'

/**
 * Normalizes a timestamp to ISO 8601 UTC with milliseconds.
 * @param {number|string|null|undefined} value - Epoch seconds (ChatGPT) or an ISO/RFC date string (Claude).
 * @returns {string|null} The ISO string, or null when absent or invalid.
 */
export function toIso(value) {
	if (value === null || value === undefined || value === '') return null
	const date = new Date(typeof value === 'number' ? value * 1000 : value)
	return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * Returns the latest of several ISO timestamps.
 * @param {(string|null)[]} values - ISO strings or nulls.
 * @returns {string|null} The latest, or null when none is set.
 */
export function latestIso(values) {
	const set = values.filter(Boolean).sort()
	return set.length ? set[set.length - 1] : null
}

/**
 * Validates a model identifier from a payload.
 * @param {any} value - The raw value.
 * @returns {string|null} The identifier, or null when it is not a usable string.
 */
export function modelId(value) {
	return typeof value === 'string' && value.trim() && value.length <= 120 ? value.trim() : null
}

/**
 * Collects unique values in first-seen order.
 * @param {(string|null)[]} values - Candidate values.
 * @returns {string[]} The distinct non-null values.
 */
export function unique(values) {
	return values.filter((v, i) => v && values.indexOf(v) === i)
}

const unknown = () => t('meta_unknown')

/**
 * Builds the label/value pairs of a turn's metadata line.
 * @param {ConversationItem} item - The conversation item.
 * @returns {string[][]} Pairs of [label, value]; empty when the item carries no metadata block.
 */
function _turnPairs(item) {
	const m = item.meta
	if (!m) return []
	const pairs = [[t('meta_created'), m.created || unknown()]]
	if (item.role === 'RESPONSE') {
		pairs.push([t('meta_model'), m.models && m.models.length ? m.models.join(', ') : unknown()])
		pairs.push([t('meta_completed'), m.completed || unknown()])
		pairs.push([t('meta_updated'), m.updated || unknown()])
	}
	return pairs
}

/**
 * Renders a turn's metadata line.
 * @param {ConversationItem} item - The conversation item.
 * @param {'md'|'html'|'txt'} format - The output format.
 * @returns {string} The line including trailing blank line(s), or an empty string.
 */
export function turnMetaBlock(item, format) {
	const pairs = _turnPairs(item)
	if (!pairs.length) return ''
	const text = pairs.map((p) => `${p[0]}: ${p[1]}`).join(' · ')
	if (format === 'html') return `\n<p><em>${escapeHtml(text)}</em></p>`
	const line = oneLine(text)
	return format === 'md' ? `> ${line}\n\n` : `${line}\n\n`
}

/**
 * Renders the document-header details: recorded model identifiers and export time.
 * @param {ExportInfo} [info] - Retrieval info with models and defaultModel.
 * @param {string} exportedAt - ISO export time.
 * @param {'md'|'html'|'txt'} format - The output format.
 * @returns {string} The block including trailing blank line(s).
 */
export function headerBlock(info, exportedAt, format) {
	const models = (info && info.models) || []
	const lines = [[t('meta_models'), models.length ? models.join(', ') : unknown()]]
	if (info && info.defaultModel && !models.includes(info.defaultModel)) {
		lines.push([t('meta_default_model'), info.defaultModel])
	}
	lines.push([t('meta_exported'), exportedAt])
	if (format === 'html') {
		return `\n<ul>${lines.map((l) => `<li>${escapeHtml(l[0])}: ${escapeHtml(l[1])}</li>`).join('')}</ul>`
	}
	const body = lines.map((l) => `${format === 'md' ? '- ' : ''}${oneLine(l[0])}: ${oneLine(l[1])}`).join('\n')
	return `${body}\n\n`
}

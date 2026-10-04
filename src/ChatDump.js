import { getPlatformParser, getSupportedPlatforms } from './ParserFactory.js'
import { processConversations } from './ConversationProcessor.js'
import { formatAsMarkdown, formatAsHtml, formatAsTxt } from './OutputFormatter.js'
import { initUI, showError, showExportOptions, showLoading } from './UIManager.js'
import { generateFilename } from './Utilities.js'
import { t } from './I18n.js'

// Failsafe: a hung/slow conversation API must not leave the toast spinning
// forever. Past this overall deadline every in-flight request is cancelled
// (AbortController) and the DOM parser takes over. Each request also has its
// own shorter deadline (RemoteUtils.REQUEST_TIMEOUT_MS).
const REMOTE_TIMEOUT_MS = 90000

export async function run() {
	try {
		// 1. Initialize UI elements (e.g., inject CSS)
		initUI()

		// 2. Detect platform and get the correct parser
		const parser = getPlatformParser()
		if (!parser) {
			throw new Error(t('unsupported', { list: getSupportedPlatforms().join(', ') }))
		}

		// 3. Extract the conversation. Platforms that virtualize the message
		// list (claude.ai keeps only the last ~12 messages in the DOM) provide
		// a remote extractor backed by their same-origin API; when it is
		// unavailable, fall back to parsing a clone of the body.
		let title = document.title
		let rawConversations = null
		if (parser.parseRemote) {
			// Immediate feedback: the API roundtrip can take seconds on long
			// conversations. The loading toast is replaced by the export
			// options (or an error) when the pipeline completes.
			showLoading()
			const controller = new AbortController()
			const timer = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS)
			try {
				const remote = await parser.parseRemote({ signal: controller.signal })
				if (remote && remote.items.length) {
					rawConversations = remote.items
					title = remote.title || title
				} else if (remote === null) {
					console.warn('[ChatDump] Remote extraction unavailable, falling back to DOM parsing')
				}
			} catch (error) {
				console.warn('[ChatDump] Remote extraction failed, falling back to DOM parsing', error)
			} finally {
				clearTimeout(timer)
			}
		}
		if (!rawConversations) {
			const bodyClone = document.body.cloneNode(true)
			rawConversations = parser.parse(bodyClone)
		}
		if (rawConversations.length === 0) {
			throw new Error(t('no_conversations'))
		}

		// 4. Process and clean the extracted conversations
		const processedConversations = processConversations(rawConversations)

		// 5. Format conversations into final outputs
		const mdText = formatAsMarkdown(processedConversations, title)
		const htmlText = formatAsHtml(processedConversations, title)
		const txtText = formatAsTxt(processedConversations, title)

		// 6. Generate filename and show export dialog
		const filename = generateFilename(parser.name, title)
		showExportOptions({ mdText, htmlText, txtText, filename })
	} catch (error) {
		console.error('[ChatDump Error]', error)
		showError(error.message)
	}
}

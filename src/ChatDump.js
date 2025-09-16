import { getPlatformParser, getSupportedPlatforms } from './ParserFactory.js'
import { processConversations } from './ConversationProcessor.js'
import { formatAsMarkdown, formatAsHtml } from './OutputFormatter.js'
import { initUI, showError, showExportOptions } from './UIManager.js'
import { generateFilename } from './Utilities.js'

export function run() {
	try {
		// 1. Initialize UI elements (e.g., inject CSS)
		initUI()

		// 2. Detect platform and get the correct parser
		const parser = getPlatformParser()
		if (!parser) {
			const supported = getSupportedPlatforms().join(', ')
			throw new Error(`Unsupported chat engine. Supported: ${supported}`)
		}

		// 3. Parse conversations from a clone of the body
		const bodyClone = document.body.cloneNode(true)
		const rawConversations = parser.parse(bodyClone)
		if (rawConversations.length === 0) {
			throw new Error('No conversations found to export.')
		}

		// 4. Process and clean the extracted conversations
		const processedConversations = processConversations(rawConversations)

		// 5. Format conversations into final outputs
		const title = document.title
		const mdText = formatAsMarkdown(processedConversations, title)
		const htmlText = formatAsHtml(processedConversations, title)

		// 6. Generate filename and show export dialog
		const filename = generateFilename(parser.name, title)
		showExportOptions({ mdText, htmlText, filename })
	} catch (error) {
		console.error('[ChatDump Error]', error)
		showError(error.message)
	}
}

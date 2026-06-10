import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { JSDOM } from 'jsdom'

for (const file of readdirSync('.').filter(f => /^(chatgpt|gemini|claude)-\d+\.html$/.test(f)).sort()) {
  const url = file.startsWith('chatgpt') ? 'https://chatgpt.com/c/x' : file.startsWith('gemini') ? 'https://gemini.google.com/app/x' : 'https://claude.ai/chat/x'
  const dom = new JSDOM(readFileSync(file, 'utf8'), { url })
  global.window = dom.window
  global.document = dom.window.document
  global.DOMParser = dom.window.DOMParser
  global.NodeFilter = dom.window.NodeFilter
  Object.defineProperty(dom.window.HTMLElement.prototype, 'innerText', { get() { return this.textContent }, configurable: true })
  const { getPlatformParser } = await import('../src/ParserFactory.js?' + file)
  const { processConversations } = await import('../src/ConversationProcessor.js?' + file)
  const { formatAsMarkdown, formatAsHtml } = await import('../src/OutputFormatter.js?' + file)
  const items = processConversations(getPlatformParser().parse(dom.window.document.body))
  const base = '/tmp/chatdump-out/' + file.replace('.html', '')
  writeFileSync(base + '.md', formatAsMarkdown(items, 'TEST: ' + file))
  writeFileSync(base + '.out.html', formatAsHtml(items, 'TEST: ' + file))
  console.log(`${file}: ${items.length} items -> ${base}.md`)
}

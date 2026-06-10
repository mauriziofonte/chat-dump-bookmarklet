import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

const raw = readFileSync('dist/chatdump.bookmarklet.js', 'utf8')
if (!raw.startsWith('javascript:void%20')) throw new Error('bad bookmarklet prefix')
const code = decodeURI(raw).replace(/^javascript:void /, '')

for (const file of ['chatgpt-2.html', 'gemini-3.html', 'claude-2.html']) {
  const url = file.startsWith('chatgpt') ? 'https://chatgpt.com/c/x' : file.startsWith('gemini') ? 'https://gemini.google.com/app/x' : 'https://claude.ai/chat/x'
  const dom = new JSDOM(readFileSync(file, 'utf8'), { url, runScripts: 'outside-only' })
  dom.window.URL.createObjectURL = () => 'blob:fake'
  dom.window.requestAnimationFrame = (cb) => cb()
  Object.defineProperty(dom.window.HTMLElement.prototype, 'innerText', { get() { return this.textContent }, configurable: true })
  // Simulate Trusted Types enforcement (require-trusted-types-for 'script', as on
  // chatgpt.com and gemini.google.com): plain-string innerHTML assignments AND
  // DOMParser.parseFromString must throw. The bookmarklet must work without ever
  // re-parsing HTML from strings.
  const ihDesc = Object.getOwnPropertyDescriptor(dom.window.Element.prototype, 'innerHTML')
  Object.defineProperty(dom.window.Element.prototype, 'innerHTML', {
    get: ihDesc.get,
    set() {
      throw new TypeError('innerHTML setter: Sink type mismatch violation blocked by CSP (simulated)')
    },
    configurable: true,
  })
  dom.window.DOMParser.prototype.parseFromString = function () {
    throw new TypeError('DOMParser.parseFromString: Sink type mismatch violation blocked by CSP (simulated)')
  }
  dom.window.eval(code)
  const toast = dom.window.document.querySelector('.chatdump-toast')
  const links = toast ? toast.querySelectorAll('a').length : 0
  const isError = toast && /Unsupported|No conversations|Error/i.test(toast.textContent)
  console.log(`${file}: toast=${!!toast}, links=${links}, error=${isError ? toast.textContent.slice(0, 80) : 'no'}`)
}

import { JSDOM } from 'jsdom'
const dom = new JSDOM('<body></body>', { url: 'https://claude.ai/' })
global.window = dom.window
global.document = dom.window.document
global.DOMParser = dom.window.DOMParser
Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true })
global.requestAnimationFrame = (cb) => cb()
global.setTimeout = (cb) => 0 // no auto-hide during test
dom.window.URL.createObjectURL = () => 'blob:fake'

const { initUI, showError, showExportOptions } = await import('../src/UIManager.js')
const { generateFilename } = await import('../src/Utilities.js')

initUI(); initUI()
console.log('style injected once:', document.querySelectorAll('#chatdump-toastify-styles').length === 1)
showError('Test error')
console.log('error toast:', document.querySelector('.chatdump-toast').textContent.includes('Test error'))
showExportOptions({ mdText: '# md', htmlText: '<h1>html</h1>', filename: 'test-file' })
const links = [...document.querySelectorAll('.chatdump-toast a')]
console.log('toast replaced, 4 links:', document.querySelectorAll('.chatdump-toast').length === 1 && links.length === 4)
console.log('download names ok:', links[0].getAttribute('download') === 'test-file.md' && links[1].getAttribute('download') === 'test-file.html')
console.log('filename:', generateFilename('claude', 'Test: àèìòù È perché — più "veloce"!'))

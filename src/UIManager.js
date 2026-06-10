const STYLE_ID = 'chatdump-toastify-styles'
const TOAST_CSS =
	'.chatdump-toast{position:fixed;top:16px;right:16px;z-index:2147483647;display:flex;align-items:center;flex-wrap:wrap;gap:8px;max-width:calc(100% - 32px);padding:10px 14px;color:#fff;border-radius:12px;box-shadow:0 10px 30px -5px rgba(0,0,0,.35);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.4;opacity:0;transform:translateY(-8px);transition:opacity .25s ease,transform .25s ease}' +
	'.chatdump-toast.on{opacity:1;transform:translateY(0)}' +
	'.chatdump-toast b{font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding-right:10px;border-right:1px solid rgba(255,255,255,.35)}' +
	'.chatdump-toast a{color:#fff;text-decoration:none;background:rgba(255,255,255,.16);padding:5px 12px;border-radius:999px;white-space:nowrap;transition:background .15s ease}' +
	'.chatdump-toast a:hover{background:rgba(255,255,255,.32)}' +
	'.chatdump-toast .toast-close{background:transparent;border:0;color:#fff;cursor:pointer;font-family:inherit;font-size:14px;line-height:1;opacity:.5;padding:2px 4px}' +
	'.chatdump-toast .toast-close:hover{opacity:1}'

/**
 * Injects the necessary CSS for toast notifications into the document head.
 * Ensures the CSS is only injected once.
 */
export function initUI() {
	if (!document.getElementById(STYLE_ID)) {
		const style = document.createElement('style')
		style.id = STYLE_ID
		style.textContent = TOAST_CSS
		document.head.appendChild(style)
	}
}

/**
 * Creates a DOM element with text content and attributes.
 * Toast content is built with DOM APIs (never HTML strings): innerHTML and
 * DOMParser are Trusted Types sinks blocked by CSP on the chat platforms.
 * @param {string} tag - The tag name.
 * @param {string} text - The text content.
 * @param {Object<string, string>} [attrs] - Attributes to set.
 * @returns {HTMLElement} The created element.
 */
function makeEl(tag, text, attrs) {
	const el = document.createElement(tag)
	el.textContent = text
	for (const key in attrs || {}) {
		el.setAttribute(key, attrs[key])
	}
	return el
}

/**
 * Hides and removes a toast element.
 * @param {HTMLElement} el - The toast element.
 */
function hideToast(el) {
	el.classList.remove('on')
	setTimeout(() => el.remove(), 400)
}

/**
 * Shows a toast notification. Any previous toast is replaced.
 * @param {Node[]} children - Content nodes of the toast.
 * @param {string} background - CSS background for the toast.
 * @param {number} duration - Auto-hide delay in ms; -1 keeps the toast until closed.
 * @returns {HTMLElement} The toast element.
 */
function showToast(children, background, duration) {
	document.querySelectorAll('.chatdump-toast').forEach((t) => t.remove())

	const el = document.createElement('div')
	el.className = 'chatdump-toast'
	el.style.background = background
	children.forEach((c) => el.appendChild(c))

	const close = makeEl('button', '✖', { class: 'toast-close' })
	close.addEventListener('click', () => hideToast(el))
	el.appendChild(close)

	document.body.appendChild(el)
	requestAnimationFrame(() => el.classList.add('on'))
	if (duration > 0) {
		setTimeout(() => hideToast(el), duration)
	}
	return el
}

/**
 * Copies text to the clipboard, with a legacy execCommand fallback.
 * @param {string} text - The text to copy.
 */
function copyText(text) {
	if (navigator.clipboard) {
		navigator.clipboard.writeText(text)
		return
	}
	const ta = document.createElement('textarea')
	ta.value = text
	document.body.appendChild(ta)
	ta.select()
	document.execCommand('copy')
	ta.remove()
}

/**
 * Displays an error message toast.
 * @param {string} message - The error message to display.
 */
export function showError(message) {
	showToast([makeEl('b', 'chatdump'), makeEl('span', message)], 'linear-gradient(135deg,#ef4444,#b91c1c)', 3000)
}

/**
 * Displays the main export options toast with download and copy links.
 * @param {{mdText: string, htmlText: string, filename: string}} options
 */
export function showExportOptions(options) {
	const mdUrl = URL.createObjectURL(new Blob([options.mdText], { type: 'text/markdown' }))
	const htmlUrl = URL.createObjectURL(new Blob([options.htmlText], { type: 'text/html' }))

	const copyLink = (label, text) => {
		const a = makeEl('a', label, { href: '#' })
		a.addEventListener('click', (e) => {
			e.preventDefault()
			copyText(text)
			hideToast(a.closest('.chatdump-toast'))
			showToast([makeEl('b', 'chatdump'), makeEl('span', 'Copied to clipboard!')], 'linear-gradient(135deg,#22c55e,#15803d)', 2000)
		})
		return a
	}

	showToast(
		[
			makeEl('b', 'chatdump'),
			makeEl('a', 'Save as MD', { href: mdUrl, download: `${options.filename}.md` }),
			makeEl('a', 'Save as HTML', { href: htmlUrl, download: `${options.filename}.html` }),
			copyLink('Copy as MD', options.mdText),
			copyLink('Copy as HTML', options.htmlText),
		],
		'linear-gradient(135deg,#0d9488,#155e75)',
		-1,
	)
}

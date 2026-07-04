import { t, isRtl } from './I18n.js'

const STYLE_ID = 'chatdump-toastify-styles'
const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const TOAST_CSS =
	`.chatdump-toast{position:fixed;top:16px;right:16px;z-index:2147483647;display:flex;align-items:center;flex-wrap:wrap;gap:6px;max-width:calc(100% - 32px);padding:10px 12px;color:#fafafa;background:rgba(23,23,26,.92);-webkit-backdrop-filter:blur(14px) saturate(150%);backdrop-filter:blur(14px) saturate(150%);border:1px solid rgba(255,255,255,.09);border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.30),0 2px 8px rgba(0,0,0,.18);font-family:${FONT_STACK};font-size:13px;line-height:1.45;opacity:0;transform:translateY(-8px) scale(.97);transition:opacity .22s ease,transform .22s cubic-bezier(.2,.9,.3,1.2)}` +
	'.chatdump-toast.on{opacity:1;transform:translateY(0) scale(1)}' +
	'.chatdump-toast .toast-brand{display:inline-flex;align-items:center;gap:7px;font-weight:600;letter-spacing:-.01em;padding-right:11px;margin-right:3px;border-right:1px solid rgba(255,255,255,.1)}' +
	'.chatdump-toast .toast-dot{width:8px;height:8px;border-radius:50%;background:var(--cd-accent,#818cf8);box-shadow:0 0 8px var(--cd-accent,#818cf8)}' +
	'.chatdump-toast a{color:#e4e4e7;text-decoration:none;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.07);padding:5px 11px;border-radius:9px;white-space:nowrap;font-weight:500;transition:background .15s ease,color .15s ease,transform .15s ease}' +
	'.chatdump-toast a:hover{background:rgba(255,255,255,.13);color:#fff;transform:translateY(-1px)}' +
	'.chatdump-toast .toast-close{background:transparent;border:0;color:#fafafa;cursor:pointer;font-family:inherit;font-size:13px;line-height:1;opacity:.45;padding:4px 5px;border-radius:7px;transition:opacity .15s ease}' +
	'.chatdump-toast .toast-close:hover{opacity:1}' +
	'.chatdump-toast .toast-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,.18);border-top-color:#fafafa;border-radius:50%;animation:chatdump-spin .7s linear infinite}' +
	'@keyframes chatdump-spin{to{transform:rotate(360deg)}}'

const ACCENTS = {
	info: '#818cf8',
	success: '#34d399',
	error: '#f87171',
}

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
 * Builds the ChatDump brand chip (accent dot + wordmark).
 * @param {string} accent - CSS color for the accent dot.
 * @returns {HTMLElement} The brand element.
 */
function makeBrand(accent) {
	const brand = makeEl('span', '', { class: 'toast-brand' })
	brand.style.setProperty('--cd-accent', accent)
	brand.appendChild(makeEl('span', '', { class: 'toast-dot' }))
	brand.appendChild(makeEl('span', 'ChatDump'))
	return brand
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
 * @param {string} accent - Accent color for the brand dot.
 * @param {number} duration - Auto-hide delay in ms; -1 keeps the toast until closed.
 * @returns {HTMLElement} The toast element.
 */
function showToast(children, accent, duration) {
	document.querySelectorAll('.chatdump-toast').forEach((t) => t.remove())

	const el = document.createElement('div')
	el.className = 'chatdump-toast'
	el.setAttribute('dir', isRtl() ? 'rtl' : 'ltr')
	el.appendChild(makeBrand(accent))
	children.forEach((c) => el.appendChild(c))

	const close = makeEl('button', '✕', { class: 'toast-close' })
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
	showToast([makeEl('span', message)], ACCENTS.error, 4000)
}

/**
 * Displays the loading toast (spinner + label) shown while the remote
 * extraction is in flight, so the UI reacts immediately. Replaced by the
 * export options (or an error) when the pipeline completes.
 */
export function showLoading() {
	showToast([makeEl('span', '', { class: 'toast-spinner' }), makeEl('span', t('exporting'))], ACCENTS.info, -1)
}

/**
 * Displays the main export options toast with download and copy links.
 * @param {{mdText: string, htmlText: string, txtText: string, filename: string}} options
 */
export function showExportOptions(options) {
	const mdUrl = URL.createObjectURL(new Blob([options.mdText], { type: 'text/markdown' }))
	const htmlUrl = URL.createObjectURL(new Blob([options.htmlText], { type: 'text/html' }))
	const txtUrl = URL.createObjectURL(new Blob([options.txtText], { type: 'text/plain' }))

	const copyLink = (label, text) => {
		const a = makeEl('a', label, { href: '#' })
		a.addEventListener('click', (e) => {
			e.preventDefault()
			copyText(text)
			hideToast(a.closest('.chatdump-toast'))
			showToast([makeEl('span', t('copied'))], ACCENTS.success, 2000)
		})
		return a
	}

	showToast(
		[
			makeEl('a', t('save_md'), { href: mdUrl, download: `${options.filename}.md` }),
			makeEl('a', t('save_html'), { href: htmlUrl, download: `${options.filename}.html` }),
			makeEl('a', t('save_txt'), { href: txtUrl, download: `${options.filename}.txt` }),
			copyLink(t('copy_md'), options.mdText),
			copyLink(t('copy_html'), options.htmlText),
			copyLink(t('copy_txt'), options.txtText),
		],
		ACCENTS.info,
		-1,
	)
}

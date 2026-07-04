/**
 * Minimal i18n for UI strings and export labels.
 * Covers the 10 most spoken languages worldwide (English, Mandarin Chinese,
 * Hindi, Spanish, French, Arabic, Bengali, Portuguese, Russian, Urdu) plus
 * Italian. The locale is resolved from the browser language (navigator.language),
 * falling back to English.
 */

const MESSAGES = {
	en: {
		save_txt: 'Save as TXT',
		copy_txt: 'Copy as TXT',
		preamble: '{format} transcript created with {tool} on {date} - Original conversation: {url}',
		exporting: 'Exporting conversation…',
		save_md: 'Save as MD',
		save_html: 'Save as HTML',
		copy_md: 'Copy as MD',
		copy_html: 'Copy as HTML',
		copied: 'Copied to clipboard!',
		unsupported: 'Unsupported chat engine. Supported: {list}',
		no_conversations: 'No conversations found to export.',
		prompt_header: 'Human Prompt {n}',
		response_header: 'LLM Response {n}',
		attachments: 'Attachments',
		attachment: 'Attachment',
		artifact: 'Artifact',
		tool: 'Tool',
	},
	zh: {
		save_txt: '保存为 TXT',
		copy_txt: '复制为 TXT',
		preamble: '{format} 转录由 {tool} 创建于 {date} - 原始对话：{url}',
		exporting: '正在导出对话…',
		save_md: '保存为 MD',
		save_html: '保存为 HTML',
		copy_md: '复制为 MD',
		copy_html: '复制为 HTML',
		copied: '已复制到剪贴板！',
		unsupported: '不支持的聊天平台。支持：{list}',
		no_conversations: '未找到可导出的对话。',
		prompt_header: '用户提问 {n}',
		response_header: 'LLM 回复 {n}',
		attachments: '附件',
		attachment: '附件',
		artifact: 'Artifact',
		tool: '工具',
	},
	hi: {
		save_txt: 'TXT में सहेजें',
		copy_txt: 'TXT कॉपी करें',
		preamble: '{format} ट्रांसक्रिप्ट {tool} द्वारा {date} को बनाई गई - मूल बातचीत: {url}',
		exporting: 'बातचीत निर्यात हो रही है…',
		save_md: 'MD में सहेजें',
		save_html: 'HTML में सहेजें',
		copy_md: 'MD कॉपी करें',
		copy_html: 'HTML कॉपी करें',
		copied: 'क्लिपबोर्ड पर कॉपी हो गया!',
		unsupported: 'असमर्थित चैट प्लेटफ़ॉर्म। समर्थित: {list}',
		no_conversations: 'निर्यात के लिए कोई बातचीत नहीं मिली।',
		prompt_header: 'उपयोगकर्ता प्रॉम्प्ट {n}',
		response_header: 'LLM उत्तर {n}',
		attachments: 'अनुलग्नक',
		attachment: 'अनुलग्नक',
		artifact: 'Artifact',
		tool: 'टूल',
	},
	es: {
		save_txt: 'Guardar como TXT',
		copy_txt: 'Copiar como TXT',
		preamble: 'Transcripción {format} creada con {tool} el {date} - Conversación original: {url}',
		exporting: 'Exportando la conversación…',
		save_md: 'Guardar como MD',
		save_html: 'Guardar como HTML',
		copy_md: 'Copiar como MD',
		copy_html: 'Copiar como HTML',
		copied: '¡Copiado al portapapeles!',
		unsupported: 'Plataforma de chat no compatible. Compatibles: {list}',
		no_conversations: 'No se encontraron conversaciones para exportar.',
		prompt_header: 'Prompt humano {n}',
		response_header: 'Respuesta del LLM {n}',
		attachments: 'Adjuntos',
		attachment: 'Adjunto',
		artifact: 'Artefacto',
		tool: 'Herramienta',
	},
	fr: {
		save_txt: 'Enregistrer en TXT',
		copy_txt: 'Copier en TXT',
		preamble: 'Transcription {format} créée avec {tool} le {date} - Conversation originale : {url}',
		exporting: 'Export de la conversation…',
		save_md: 'Enregistrer en MD',
		save_html: 'Enregistrer en HTML',
		copy_md: 'Copier en MD',
		copy_html: 'Copier en HTML',
		copied: 'Copié dans le presse-papiers !',
		unsupported: 'Plateforme de chat non prise en charge. Prises en charge : {list}',
		no_conversations: 'Aucune conversation à exporter.',
		prompt_header: 'Prompt humain {n}',
		response_header: 'Réponse du LLM {n}',
		attachments: 'Pièces jointes',
		attachment: 'Pièce jointe',
		artifact: 'Artefact',
		tool: 'Outil',
	},
	ar: {
		save_txt: 'حفظ بصيغة TXT',
		copy_txt: 'نسخ بصيغة TXT',
		preamble: 'نسخة {format} أُنشئت باستخدام {tool} في {date} - المحادثة الأصلية: {url}',
		exporting: 'جارٍ تصدير المحادثة…',
		save_md: 'حفظ بصيغة MD',
		save_html: 'حفظ بصيغة HTML',
		copy_md: 'نسخ بصيغة MD',
		copy_html: 'نسخ بصيغة HTML',
		copied: 'تم النسخ إلى الحافظة!',
		unsupported: 'منصة دردشة غير مدعومة. المدعومة: {list}',
		no_conversations: 'لا توجد محادثات للتصدير.',
		prompt_header: 'موجه المستخدم {n}',
		response_header: 'رد LLM {n}',
		attachments: 'مرفقات',
		attachment: 'مرفق',
		artifact: 'Artifact',
		tool: 'أداة',
	},
	bn: {
		save_txt: 'TXT হিসেবে সংরক্ষণ',
		copy_txt: 'TXT কপি করুন',
		preamble: '{format} ট্রান্সক্রিপ্ট {tool} দিয়ে {date} তারিখে তৈরি - মূল কথোপকথন: {url}',
		exporting: 'কথোপকথন রপ্তানি হচ্ছে…',
		save_md: 'MD হিসেবে সংরক্ষণ',
		save_html: 'HTML হিসেবে সংরক্ষণ',
		copy_md: 'MD কপি করুন',
		copy_html: 'HTML কপি করুন',
		copied: 'ক্লিপবোর্ডে কপি হয়েছে!',
		unsupported: 'অসমর্থিত চ্যাট প্ল্যাটফর্ম। সমর্থিত: {list}',
		no_conversations: 'রপ্তানির জন্য কোনো কথোপকথন পাওয়া যায়নি।',
		prompt_header: 'ব্যবহারকারীর প্রম্পট {n}',
		response_header: 'LLM উত্তর {n}',
		attachments: 'সংযুক্তি',
		attachment: 'সংযুক্তি',
		artifact: 'Artifact',
		tool: 'টুল',
	},
	pt: {
		save_txt: 'Salvar como TXT',
		copy_txt: 'Copiar como TXT',
		preamble: 'Transcrição {format} criada com {tool} em {date} - Conversa original: {url}',
		exporting: 'Exportando a conversa…',
		save_md: 'Salvar como MD',
		save_html: 'Salvar como HTML',
		copy_md: 'Copiar como MD',
		copy_html: 'Copiar como HTML',
		copied: 'Copiado para a área de transferência!',
		unsupported: 'Plataforma de chat não suportada. Suportadas: {list}',
		no_conversations: 'Nenhuma conversa encontrada para exportar.',
		prompt_header: 'Prompt humano {n}',
		response_header: 'Resposta do LLM {n}',
		attachments: 'Anexos',
		attachment: 'Anexo',
		artifact: 'Artefato',
		tool: 'Ferramenta',
	},
	ru: {
		save_txt: 'Сохранить как TXT',
		copy_txt: 'Копировать как TXT',
		preamble: 'Транскрипт {format} создан с помощью {tool} {date} - Исходная беседа: {url}',
		exporting: 'Экспорт беседы…',
		save_md: 'Сохранить как MD',
		save_html: 'Сохранить как HTML',
		copy_md: 'Копировать как MD',
		copy_html: 'Копировать как HTML',
		copied: 'Скопировано в буфер обмена!',
		unsupported: 'Платформа чата не поддерживается. Поддерживаются: {list}',
		no_conversations: 'Не найдено бесед для экспорта.',
		prompt_header: 'Запрос пользователя {n}',
		response_header: 'Ответ LLM {n}',
		attachments: 'Вложения',
		attachment: 'Вложение',
		artifact: 'Артефакт',
		tool: 'Инструмент',
	},
	ur: {
		save_txt: 'TXT محفوظ کریں',
		copy_txt: 'TXT کاپی کریں',
		preamble: '{format} ٹرانسکرپٹ {tool} کے ذریعے {date} کو بنائی گئی - اصل گفتگو: {url}',
		exporting: 'گفتگو برآمد ہو رہی ہے…',
		save_md: 'MD محفوظ کریں',
		save_html: 'HTML محفوظ کریں',
		copy_md: 'MD کاپی کریں',
		copy_html: 'HTML کاپی کریں',
		copied: 'کلپ بورڈ پر کاپی ہو گیا!',
		unsupported: 'غیر تعاون یافتہ چیٹ پلیٹ فارم۔ تعاون یافتہ: {list}',
		no_conversations: 'برآمد کے لیے کوئی گفتگو نہیں ملی۔',
		prompt_header: 'صارف پرامپٹ {n}',
		response_header: 'LLM جواب {n}',
		attachments: 'منسلکات',
		attachment: 'منسلکہ',
		artifact: 'Artifact',
		tool: 'ٹول',
	},
	it: {
		save_txt: 'Salva come TXT',
		copy_txt: 'Copia come TXT',
		preamble: 'Transcript {format} creato con {tool} il {date} - Conversazione originale: {url}',
		exporting: 'Esportazione della conversazione…',
		save_md: 'Salva come MD',
		save_html: 'Salva come HTML',
		copy_md: 'Copia come MD',
		copy_html: 'Copia come HTML',
		copied: 'Copiato negli appunti!',
		unsupported: 'Piattaforma di chat non supportata. Supportate: {list}',
		no_conversations: 'Nessuna conversazione da esportare.',
		prompt_header: 'Prompt umano {n}',
		response_header: 'Risposta LLM {n}',
		attachments: 'Allegati',
		attachment: 'Allegato',
		artifact: 'Artefatto',
		tool: 'Strumento',
	},
}

/**
 * Resolves the active locale from the browser language.
 * @returns {string} A key of MESSAGES.
 */
function _locale() {
	const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en'
	const primary = lang.toLowerCase().split('-')[0]
	return MESSAGES[primary] ? primary : 'en'
}

/**
 * Translates a message key into the browser language, with {placeholder}
 * substitution. Unknown keys return the key itself.
 * @param {string} key - The message key.
 * @param {Object<string, string|number>} [params] - Placeholder values.
 * @returns {string} The translated string.
 */
export function t(key, params) {
	const table = MESSAGES[_locale()]
	let text = table[key] || MESSAGES.en[key] || key
	for (const name in params || {}) {
		text = text.replace(`{${name}}`, String(params[name]))
	}
	return text
}

/**
 * True when the active locale is written right-to-left.
 * @returns {boolean}
 */
export function isRtl() {
	const locale = _locale()
	return locale === 'ar' || locale === 'ur'
}

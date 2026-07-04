/**
 * @module types
 * This file contains JSDoc type definitions for the ChatDump application.
 * It is used for type hinting and not meant to be executed.
 */

/**
 * Represents a single turn in a conversation.
 * @typedef {object} ConversationItem
 * @property {'PROMPT'|'RESPONSE'} role - The role of the speaker.
 * @property {number} num - The sequential number of the turn.
 * @property {Element} [content] - A detached DOM element containing the turn content.
 *           Content travels through the pipeline as DOM nodes (never as HTML strings)
 *           because re-parsing strings requires Trusted Types sinks (innerHTML,
 *           DOMParser.parseFromString) that are blocked by CSP on the chat platforms.
 * @property {string} [markdown] - Raw Markdown source for the turn. Set by remote
 *           (API-based) extractors instead of `content`; exactly one of the two
 *           must be present. Markdown items skip DOM cleaning entirely.
 * @property {boolean} [richText] - For DOM-based PROMPT items: convert the content
 *           through Turndown (preserves code fences, lists) instead of innerText.
 * @property {string[]} [attachments] - File names attached to the turn (prompt uploads).
 */

/**
 * Result of a remote (API-based) extraction.
 * @typedef {object} RemoteConversation
 * @property {string} title - The conversation title as known by the platform.
 * @property {ConversationItem[]} items - The extracted turns.
 */

/**
 * Defines the interface for a platform-specific parser module.
 * @typedef {object} ParserModule
 * @property {string} name - The lowercase name of the platform (e.g., 'chatgpt').
 * @property {function(string): boolean} matches - A function that returns true if the parser is for the given hostname.
 * @property {function(Document): ConversationItem[]} parse - A function that extracts all conversation turns from the document body.
 * @property {function(): Promise<RemoteConversation|null>} [parseRemote] - Optional
 *           API-based extractor. Runs before the DOM parser: platforms that virtualize
 *           the message list (claude.ai keeps only ~12 messages in the DOM) can only be
 *           exported completely through their same-origin conversation API. Returning
 *           null (or throwing) falls back to the DOM parser.
 */

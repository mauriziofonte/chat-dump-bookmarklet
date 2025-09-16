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
 * @property {string} content - The raw HTML content of the turn.
 */

/**
 * Defines the interface for a platform-specific parser module.
 * @typedef {object} ParserModule
 * @property {string} name - The lowercase name of the platform (e.g., 'chatgpt').
 * @property {function(string): boolean} matches - A function that returns true if the parser is for the given hostname.
 * @property {function(Document): ConversationItem[]} parse - A function that extracts all conversation turns from the document body.
 */

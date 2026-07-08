/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Chat_ContextInputs */

const en_chat_context = /** @type {(inputs: Chat_ContextInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Context (${i?.count})`)
};

const zh_chat_context = /** @type {(inputs: Chat_ContextInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`上下文 (${i?.count})`)
};

/**
* | output |
* | --- |
* | "Context ({count})" |
*
* @param {Chat_ContextInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const chat_context = /** @type {((inputs: Chat_ContextInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Chat_ContextInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_chat_context(inputs)
	return zh_chat_context(inputs)
});
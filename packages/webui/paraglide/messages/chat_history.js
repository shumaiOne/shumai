/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Chat_HistoryInputs */

const en_chat_history = /** @type {(inputs: Chat_HistoryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Chat History`)
};

const zh_chat_history = /** @type {(inputs: Chat_HistoryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`聊天历史`)
};

/**
* | output |
* | --- |
* | "Chat History" |
*
* @param {Chat_HistoryInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const chat_history = /** @type {((inputs?: Chat_HistoryInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Chat_HistoryInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_chat_history(inputs)
	return zh_chat_history(inputs)
});
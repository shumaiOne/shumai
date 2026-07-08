/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_History_ChatsInputs */

const en_no_history_chats = /** @type {(inputs: No_History_ChatsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No chat history yet.`)
};

const zh_no_history_chats = /** @type {(inputs: No_History_ChatsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`暂无聊天历史。`)
};

/**
* | output |
* | --- |
* | "No chat history yet." |
*
* @param {No_History_ChatsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_history_chats = /** @type {((inputs?: No_History_ChatsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_History_ChatsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_history_chats(inputs)
	return zh_no_history_chats(inputs)
});
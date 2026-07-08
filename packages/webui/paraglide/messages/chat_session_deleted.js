/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Chat_Session_DeletedInputs */

const en_chat_session_deleted = /** @type {(inputs: Chat_Session_DeletedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Chat session deleted`)
};

const zh_chat_session_deleted = /** @type {(inputs: Chat_Session_DeletedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`聊天会话已删除`)
};

/**
* | output |
* | --- |
* | "Chat session deleted" |
*
* @param {Chat_Session_DeletedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const chat_session_deleted = /** @type {((inputs?: Chat_Session_DeletedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Chat_Session_DeletedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_chat_session_deleted(inputs)
	return zh_chat_session_deleted(inputs)
});
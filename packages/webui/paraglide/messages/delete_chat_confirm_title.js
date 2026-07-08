/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Delete_Chat_Confirm_TitleInputs */

const en_delete_chat_confirm_title = /** @type {(inputs: Delete_Chat_Confirm_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Delete Chat Session`)
};

const zh_delete_chat_confirm_title = /** @type {(inputs: Delete_Chat_Confirm_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`删除聊天会话`)
};

/**
* | output |
* | --- |
* | "Delete Chat Session" |
*
* @param {Delete_Chat_Confirm_TitleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_chat_confirm_title = /** @type {((inputs?: Delete_Chat_Confirm_TitleInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_Chat_Confirm_TitleInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_chat_confirm_title(inputs)
	return zh_delete_chat_confirm_title(inputs)
});
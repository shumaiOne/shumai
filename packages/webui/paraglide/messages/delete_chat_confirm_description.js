/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Delete_Chat_Confirm_DescriptionInputs */

const en_delete_chat_confirm_description = /** @type {(inputs: Delete_Chat_Confirm_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Are you sure you want to delete this chat session? This action cannot be undone.`)
};

const zh_delete_chat_confirm_description = /** @type {(inputs: Delete_Chat_Confirm_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`您确定要删除此聊天会话吗？此操作无法撤销。`)
};

/**
* | output |
* | --- |
* | "Are you sure you want to delete this chat session? This action cannot be undone." |
*
* @param {Delete_Chat_Confirm_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_chat_confirm_description = /** @type {((inputs?: Delete_Chat_Confirm_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_Chat_Confirm_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_chat_confirm_description(inputs)
	return zh_delete_chat_confirm_description(inputs)
});
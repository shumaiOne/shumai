/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Delete_Comment_ConfirmInputs */

const en_delete_comment_confirm = /** @type {(inputs: Delete_Comment_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Delete Comment?`)
};

const zh_delete_comment_confirm = /** @type {(inputs: Delete_Comment_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`删除评论？`)
};

/**
* | output |
* | --- |
* | "Delete Comment?" |
*
* @param {Delete_Comment_ConfirmInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_comment_confirm = /** @type {((inputs?: Delete_Comment_ConfirmInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_Comment_ConfirmInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_comment_confirm(inputs)
	return zh_delete_comment_confirm(inputs)
});
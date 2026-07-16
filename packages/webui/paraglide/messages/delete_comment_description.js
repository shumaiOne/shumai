/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Delete_Comment_DescriptionInputs */

const en_delete_comment_description = /** @type {(inputs: Delete_Comment_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Are you sure you want to delete this comment? This action cannot be undone.`)
};

const zh_delete_comment_description = /** @type {(inputs: Delete_Comment_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`您确定要删除这条评论吗？此操作将无法撤回。`)
};

/**
* | output |
* | --- |
* | "Are you sure you want to delete this comment? This action cannot be undone." |
*
* @param {Delete_Comment_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_comment_description = /** @type {((inputs?: Delete_Comment_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_Comment_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_comment_description(inputs)
	return zh_delete_comment_description(inputs)
});
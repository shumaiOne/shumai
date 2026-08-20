/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_CommentInputs */

const en_add_comment = /** @type {(inputs: Add_CommentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Add Comment`)
};

const zh_add_comment = /** @type {(inputs: Add_CommentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`添加评论`)
};

/**
* | output |
* | --- |
* | "Add Comment" |
*
* @param {Add_CommentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_comment = /** @type {((inputs?: Add_CommentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_CommentInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_add_comment(inputs)
	return zh_add_comment(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Comments_YetInputs */

const en_no_comments_yet = /** @type {(inputs: No_Comments_YetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No comments yet`)
};

const zh_no_comments_yet = /** @type {(inputs: No_Comments_YetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`暂无评论`)
};

/**
* | output |
* | --- |
* | "No comments yet" |
*
* @param {No_Comments_YetInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_comments_yet = /** @type {((inputs?: No_Comments_YetInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Comments_YetInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_comments_yet(inputs)
	return zh_no_comments_yet(inputs)
});
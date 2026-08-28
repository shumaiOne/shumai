/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} All_CommentsInputs */

const en_all_comments = /** @type {(inputs: All_CommentsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`All comments`)
};

const zh_all_comments = /** @type {(inputs: All_CommentsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`所有评论`)
};

/**
* | output |
* | --- |
* | "All comments" |
*
* @param {All_CommentsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const all_comments = /** @type {((inputs?: All_CommentsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<All_CommentsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_all_comments(inputs)
	return zh_all_comments(inputs)
});
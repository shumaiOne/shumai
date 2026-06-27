/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} General_CommentsInputs */

const en_general_comments = /** @type {(inputs: General_CommentsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`General Comments`)
};

const zh_general_comments = /** @type {(inputs: General_CommentsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`普通评论`)
};

/**
* | output |
* | --- |
* | "General Comments" |
*
* @param {General_CommentsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const general_comments = /** @type {((inputs?: General_CommentsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<General_CommentsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_general_comments(inputs)
	return zh_general_comments(inputs)
});
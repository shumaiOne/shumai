/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Copy_CommentsInputs */

const en_copy_comments = /** @type {(inputs: Copy_CommentsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Copy comments`)
};

const zh_copy_comments = /** @type {(inputs: Copy_CommentsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`复制评论`)
};

/**
* | output |
* | --- |
* | "Copy comments" |
*
* @param {Copy_CommentsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const copy_comments = /** @type {((inputs?: Copy_CommentsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Copy_CommentsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_copy_comments(inputs)
	return zh_copy_comments(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Comment_PlaceholderInputs */

const en_comment_placeholder = /** @type {(inputs: Comment_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Write a comment...`)
};

const zh_comment_placeholder = /** @type {(inputs: Comment_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`写下评论...`)
};

/**
* | output |
* | --- |
* | "Write a comment..." |
*
* @param {Comment_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const comment_placeholder = /** @type {((inputs?: Comment_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Comment_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_comment_placeholder(inputs)
	return zh_comment_placeholder(inputs)
});
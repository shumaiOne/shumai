/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_Post_CommentInputs */

const en_failed_to_post_comment = /** @type {(inputs: Failed_To_Post_CommentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to post comment`)
};

const zh_failed_to_post_comment = /** @type {(inputs: Failed_To_Post_CommentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`发送评论失败`)
};

/**
* | output |
* | --- |
* | "Failed to post comment" |
*
* @param {Failed_To_Post_CommentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_post_comment = /** @type {((inputs?: Failed_To_Post_CommentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_Post_CommentInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_to_post_comment(inputs)
	return zh_failed_to_post_comment(inputs)
});
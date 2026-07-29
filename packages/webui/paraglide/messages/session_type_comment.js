/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Session_Type_CommentInputs */

const en_session_type_comment = /** @type {(inputs: Session_Type_CommentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Comment`)
};

const zh_session_type_comment = /** @type {(inputs: Session_Type_CommentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`评论`)
};

/**
* | output |
* | --- |
* | "Comment" |
*
* @param {Session_Type_CommentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const session_type_comment = /** @type {((inputs?: Session_Type_CommentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Session_Type_CommentInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_session_type_comment(inputs)
	return zh_session_type_comment(inputs)
});
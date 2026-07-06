/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ message: NonNullable<unknown> }} Reply_To_MessageInputs */

const en_reply_to_message = /** @type {(inputs: Reply_To_MessageInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`reply to: ${i?.message}`)
};

const zh_reply_to_message = /** @type {(inputs: Reply_To_MessageInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`回复：${i?.message}`)
};

/**
* | output |
* | --- |
* | "reply to: {message}" |
*
* @param {Reply_To_MessageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const reply_to_message = /** @type {((inputs: Reply_To_MessageInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Reply_To_MessageInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_reply_to_message(inputs)
	return zh_reply_to_message(inputs)
});
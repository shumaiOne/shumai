/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ReplyInputs */

const en_reply = /** @type {(inputs: ReplyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Reply`)
};

const zh_reply = /** @type {(inputs: ReplyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`回复`)
};

/**
* | output |
* | --- |
* | "Reply" |
*
* @param {ReplyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const reply = /** @type {((inputs?: ReplyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ReplyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_reply(inputs)
	return zh_reply(inputs)
});
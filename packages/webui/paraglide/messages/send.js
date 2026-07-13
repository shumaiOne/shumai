/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} SendInputs */

const en_send = /** @type {(inputs: SendInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Send`)
};

const zh_send = /** @type {(inputs: SendInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`发送`)
};

/**
* | output |
* | --- |
* | "Send" |
*
* @param {SendInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const send = /** @type {((inputs?: SendInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<SendInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_send(inputs)
	return zh_send(inputs)
});
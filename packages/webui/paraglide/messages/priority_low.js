/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Priority_LowInputs */

const en_priority_low = /** @type {(inputs: Priority_LowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Low`)
};

const zh_priority_low = /** @type {(inputs: Priority_LowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`低`)
};

/**
* | output |
* | --- |
* | "Low" |
*
* @param {Priority_LowInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const priority_low = /** @type {((inputs?: Priority_LowInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Priority_LowInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_priority_low(inputs)
	return zh_priority_low(inputs)
});
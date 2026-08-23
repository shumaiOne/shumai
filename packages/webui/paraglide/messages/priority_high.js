/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Priority_HighInputs */

const en_priority_high = /** @type {(inputs: Priority_HighInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`High`)
};

const zh_priority_high = /** @type {(inputs: Priority_HighInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`高`)
};

/**
* | output |
* | --- |
* | "High" |
*
* @param {Priority_HighInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const priority_high = /** @type {((inputs?: Priority_HighInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Priority_HighInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_priority_high(inputs)
	return zh_priority_high(inputs)
});
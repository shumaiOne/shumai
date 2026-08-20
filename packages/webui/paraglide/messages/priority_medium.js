/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Priority_MediumInputs */

const en_priority_medium = /** @type {(inputs: Priority_MediumInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Medium`)
};

const zh_priority_medium = /** @type {(inputs: Priority_MediumInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`中`)
};

/**
* | output |
* | --- |
* | "Medium" |
*
* @param {Priority_MediumInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const priority_medium = /** @type {((inputs?: Priority_MediumInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Priority_MediumInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_priority_medium(inputs)
	return zh_priority_medium(inputs)
});
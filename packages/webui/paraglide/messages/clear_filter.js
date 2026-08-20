/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Clear_FilterInputs */

const en_clear_filter = /** @type {(inputs: Clear_FilterInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Clear`)
};

const zh_clear_filter = /** @type {(inputs: Clear_FilterInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`清除`)
};

/**
* | output |
* | --- |
* | "Clear" |
*
* @param {Clear_FilterInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const clear_filter = /** @type {((inputs?: Clear_FilterInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Clear_FilterInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_clear_filter(inputs)
	return zh_clear_filter(inputs)
});
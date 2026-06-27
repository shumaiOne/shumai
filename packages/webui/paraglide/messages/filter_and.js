/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Filter_AndInputs */

const en_filter_and = /** @type {(inputs: Filter_AndInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`and`)
};

const zh_filter_and = /** @type {(inputs: Filter_AndInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`且`)
};

/**
* | output |
* | --- |
* | "and" |
*
* @param {Filter_AndInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const filter_and = /** @type {((inputs?: Filter_AndInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Filter_AndInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_filter_and(inputs)
	return zh_filter_and(inputs)
});
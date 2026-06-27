/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Exact_DateInputs */

const en_exact_date = /** @type {(inputs: Exact_DateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Exact date...`)
};

const zh_exact_date = /** @type {(inputs: Exact_DateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`精确日期...`)
};

/**
* | output |
* | --- |
* | "Exact date..." |
*
* @param {Exact_DateInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const exact_date = /** @type {((inputs?: Exact_DateInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Exact_DateInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_exact_date(inputs)
	return zh_exact_date(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} CostInputs */

const en_cost = /** @type {(inputs: CostInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Cost`)
};

const zh_cost = /** @type {(inputs: CostInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`费用`)
};

/**
* | output |
* | --- |
* | "Cost" |
*
* @param {CostInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const cost = /** @type {((inputs?: CostInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<CostInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_cost(inputs)
	return zh_cost(inputs)
});
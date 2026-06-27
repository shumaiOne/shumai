/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Output_Cost_1mInputs */

const en_output_cost_1m = /** @type {(inputs: Output_Cost_1mInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Output Cost (1M)`)
};

const zh_output_cost_1m = /** @type {(inputs: Output_Cost_1mInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`输出成本（每百万）`)
};

/**
* | output |
* | --- |
* | "Output Cost (1M)" |
*
* @param {Output_Cost_1mInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const output_cost_1m = /** @type {((inputs?: Output_Cost_1mInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Output_Cost_1mInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_output_cost_1m(inputs)
	return zh_output_cost_1m(inputs)
});
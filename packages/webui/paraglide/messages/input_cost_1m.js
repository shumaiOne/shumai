/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Input_Cost_1mInputs */

const en_input_cost_1m = /** @type {(inputs: Input_Cost_1mInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Input Cost (1M)`)
};

const zh_input_cost_1m = /** @type {(inputs: Input_Cost_1mInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`输入成本（每百万）`)
};

/**
* | output |
* | --- |
* | "Input Cost (1M)" |
*
* @param {Input_Cost_1mInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const input_cost_1m = /** @type {((inputs?: Input_Cost_1mInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Input_Cost_1mInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_input_cost_1m(inputs)
	return zh_input_cost_1m(inputs)
});
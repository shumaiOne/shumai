/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ input: NonNullable<unknown>, output: NonNullable<unknown> }} Cost_Per_MillionInputs */

const en_cost_per_million = /** @type {(inputs: Cost_Per_MillionInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`$${i?.input}/1M in · $${i?.output}/1M out`)
};

const zh_cost_per_million = /** @type {(inputs: Cost_Per_MillionInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`$${i?.input}/1M 输入 · $${i?.output}/1M 输出`)
};

/**
* | output |
* | --- |
* | "${input}/1M in · ${output}/1M out" |
*
* @param {Cost_Per_MillionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const cost_per_million = /** @type {((inputs: Cost_Per_MillionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Cost_Per_MillionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_cost_per_million(inputs)
	return zh_cost_per_million(inputs)
});
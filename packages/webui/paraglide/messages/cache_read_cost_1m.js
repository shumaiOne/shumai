/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Cache_Read_Cost_1mInputs */

const en_cache_read_cost_1m = /** @type {(inputs: Cache_Read_Cost_1mInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Cache Read Cost (1M)`)
};

const zh_cache_read_cost_1m = /** @type {(inputs: Cache_Read_Cost_1mInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`缓存读取成本（每百万）`)
};

/**
* | output |
* | --- |
* | "Cache Read Cost (1M)" |
*
* @param {Cache_Read_Cost_1mInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const cache_read_cost_1m = /** @type {((inputs?: Cache_Read_Cost_1mInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Cache_Read_Cost_1mInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_cache_read_cost_1m(inputs)
	return zh_cache_read_cost_1m(inputs)
});
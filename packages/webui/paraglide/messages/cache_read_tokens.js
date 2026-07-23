/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Cache_Read_TokensInputs */

const en_cache_read_tokens = /** @type {(inputs: Cache_Read_TokensInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Cache Read Tokens`)
};

const zh_cache_read_tokens = /** @type {(inputs: Cache_Read_TokensInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`缓存读取 Token`)
};

/**
* | output |
* | --- |
* | "Cache Read Tokens" |
*
* @param {Cache_Read_TokensInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const cache_read_tokens = /** @type {((inputs?: Cache_Read_TokensInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Cache_Read_TokensInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_cache_read_tokens(inputs)
	return zh_cache_read_tokens(inputs)
});
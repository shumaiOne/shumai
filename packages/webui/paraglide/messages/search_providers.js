/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Search_ProvidersInputs */

const en_search_providers = /** @type {(inputs: Search_ProvidersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Search providers...`)
};

const zh_search_providers = /** @type {(inputs: Search_ProvidersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`搜索提供商...`)
};

/**
* | output |
* | --- |
* | "Search providers..." |
*
* @param {Search_ProvidersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const search_providers = /** @type {((inputs?: Search_ProvidersInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Search_ProvidersInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_search_providers(inputs)
	return zh_search_providers(inputs)
});
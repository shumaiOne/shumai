/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Search_Providers_PlaceholderInputs */

const en_search_providers_placeholder = /** @type {(inputs: Search_Providers_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Search providers...`)
};

const zh_search_providers_placeholder = /** @type {(inputs: Search_Providers_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`搜索提供商...`)
};

/**
* | output |
* | --- |
* | "Search providers..." |
*
* @param {Search_Providers_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const search_providers_placeholder = /** @type {((inputs?: Search_Providers_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Search_Providers_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_search_providers_placeholder(inputs)
	return zh_search_providers_placeholder(inputs)
});
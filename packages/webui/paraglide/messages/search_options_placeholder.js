/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Search_Options_PlaceholderInputs */

const en_search_options_placeholder = /** @type {(inputs: Search_Options_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Search options...`)
};

const zh_search_options_placeholder = /** @type {(inputs: Search_Options_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`搜索选项...`)
};

/**
* | output |
* | --- |
* | "Search options..." |
*
* @param {Search_Options_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const search_options_placeholder = /** @type {((inputs?: Search_Options_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Search_Options_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_search_options_placeholder(inputs)
	return zh_search_options_placeholder(inputs)
});
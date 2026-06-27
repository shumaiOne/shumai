/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Search_Fields_PlaceholderInputs */

const en_search_fields_placeholder = /** @type {(inputs: Search_Fields_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Search fields`)
};

const zh_search_fields_placeholder = /** @type {(inputs: Search_Fields_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`搜索字段`)
};

/**
* | output |
* | --- |
* | "Search fields" |
*
* @param {Search_Fields_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const search_fields_placeholder = /** @type {((inputs?: Search_Fields_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Search_Fields_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_search_fields_placeholder(inputs)
	return zh_search_fields_placeholder(inputs)
});
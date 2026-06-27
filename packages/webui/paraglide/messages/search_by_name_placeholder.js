/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Search_By_Name_PlaceholderInputs */

const en_search_by_name_placeholder = /** @type {(inputs: Search_By_Name_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Search records by name...`)
};

const zh_search_by_name_placeholder = /** @type {(inputs: Search_By_Name_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`按名称搜索记录...`)
};

/**
* | output |
* | --- |
* | "Search records by name..." |
*
* @param {Search_By_Name_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const search_by_name_placeholder = /** @type {((inputs?: Search_By_Name_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Search_By_Name_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_search_by_name_placeholder(inputs)
	return zh_search_by_name_placeholder(inputs)
});
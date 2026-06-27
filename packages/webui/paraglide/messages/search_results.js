/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Search_ResultsInputs */

const en_search_results = /** @type {(inputs: Search_ResultsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Search Results`)
};

const zh_search_results = /** @type {(inputs: Search_ResultsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`搜索结果`)
};

/**
* | output |
* | --- |
* | "Search Results" |
*
* @param {Search_ResultsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const search_results = /** @type {((inputs?: Search_ResultsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Search_ResultsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_search_results(inputs)
	return zh_search_results(inputs)
});
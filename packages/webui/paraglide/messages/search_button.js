/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Search_ButtonInputs */

const en_search_button = /** @type {(inputs: Search_ButtonInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Search`)
};

const zh_search_button = /** @type {(inputs: Search_ButtonInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`搜索`)
};

/**
* | output |
* | --- |
* | "Search" |
*
* @param {Search_ButtonInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const search_button = /** @type {((inputs?: Search_ButtonInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Search_ButtonInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_search_button(inputs)
	return zh_search_button(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Search_Item_IdInputs */

const en_search_item_id = /** @type {(inputs: Search_Item_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Search Item ID...`)
};

const zh_search_item_id = /** @type {(inputs: Search_Item_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`搜索条目 ID...`)
};

/**
* | output |
* | --- |
* | "Search Item ID..." |
*
* @param {Search_Item_IdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const search_item_id = /** @type {((inputs?: Search_Item_IdInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Search_Item_IdInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_search_item_id(inputs)
	return zh_search_item_id(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sort_Largest_To_SmallestInputs */

const en_sort_largest_to_smallest = /** @type {(inputs: Sort_Largest_To_SmallestInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Largest → Smallest`)
};

const zh_sort_largest_to_smallest = /** @type {(inputs: Sort_Largest_To_SmallestInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`最大 → 最小`)
};

/**
* | output |
* | --- |
* | "Largest → Smallest" |
*
* @param {Sort_Largest_To_SmallestInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sort_largest_to_smallest = /** @type {((inputs?: Sort_Largest_To_SmallestInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sort_Largest_To_SmallestInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sort_largest_to_smallest(inputs)
	return zh_sort_largest_to_smallest(inputs)
});
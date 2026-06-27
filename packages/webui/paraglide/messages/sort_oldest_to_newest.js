/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sort_Oldest_To_NewestInputs */

const en_sort_oldest_to_newest = /** @type {(inputs: Sort_Oldest_To_NewestInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Oldest → Newest`)
};

const zh_sort_oldest_to_newest = /** @type {(inputs: Sort_Oldest_To_NewestInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`最旧 → 最新`)
};

/**
* | output |
* | --- |
* | "Oldest → Newest" |
*
* @param {Sort_Oldest_To_NewestInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sort_oldest_to_newest = /** @type {((inputs?: Sort_Oldest_To_NewestInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sort_Oldest_To_NewestInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sort_oldest_to_newest(inputs)
	return zh_sort_oldest_to_newest(inputs)
});
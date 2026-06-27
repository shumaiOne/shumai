/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sort_Newest_To_OldestInputs */

const en_sort_newest_to_oldest = /** @type {(inputs: Sort_Newest_To_OldestInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Newest → Oldest`)
};

const zh_sort_newest_to_oldest = /** @type {(inputs: Sort_Newest_To_OldestInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`最新 → 最旧`)
};

/**
* | output |
* | --- |
* | "Newest → Oldest" |
*
* @param {Sort_Newest_To_OldestInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sort_newest_to_oldest = /** @type {((inputs?: Sort_Newest_To_OldestInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sort_Newest_To_OldestInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sort_newest_to_oldest(inputs)
	return zh_sort_newest_to_oldest(inputs)
});
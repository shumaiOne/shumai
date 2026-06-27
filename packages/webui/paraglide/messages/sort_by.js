/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sort_ByInputs */

const en_sort_by = /** @type {(inputs: Sort_ByInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sort by`)
};

const zh_sort_by = /** @type {(inputs: Sort_ByInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`排序`)
};

/**
* | output |
* | --- |
* | "Sort by" |
*
* @param {Sort_ByInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sort_by = /** @type {((inputs?: Sort_ByInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sort_ByInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sort_by(inputs)
	return zh_sort_by(inputs)
});
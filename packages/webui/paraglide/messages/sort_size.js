/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sort_SizeInputs */

const en_sort_size = /** @type {(inputs: Sort_SizeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Size`)
};

const zh_sort_size = /** @type {(inputs: Sort_SizeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`大小`)
};

/**
* | output |
* | --- |
* | "Size" |
*
* @param {Sort_SizeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sort_size = /** @type {((inputs?: Sort_SizeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sort_SizeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sort_size(inputs)
	return zh_sort_size(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Size_PrefixInputs */

const en_size_prefix = /** @type {(inputs: Size_PrefixInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Size:`)
};

const zh_size_prefix = /** @type {(inputs: Size_PrefixInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`大小：`)
};

/**
* | output |
* | --- |
* | "Size:" |
*
* @param {Size_PrefixInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const size_prefix = /** @type {((inputs?: Size_PrefixInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Size_PrefixInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_size_prefix(inputs)
	return zh_size_prefix(inputs)
});
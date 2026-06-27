/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Size_ColumnInputs */

const en_size_column = /** @type {(inputs: Size_ColumnInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Size`)
};

const zh_size_column = /** @type {(inputs: Size_ColumnInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`大小`)
};

/**
* | output |
* | --- |
* | "Size" |
*
* @param {Size_ColumnInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const size_column = /** @type {((inputs?: Size_ColumnInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Size_ColumnInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_size_column(inputs)
	return zh_size_column(inputs)
});
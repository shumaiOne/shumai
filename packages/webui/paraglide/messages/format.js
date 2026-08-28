/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} FormatInputs */

const en_format = /** @type {(inputs: FormatInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Format`)
};

const zh_format = /** @type {(inputs: FormatInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`格式`)
};

/**
* | output |
* | --- |
* | "Format" |
*
* @param {FormatInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const format = /** @type {((inputs?: FormatInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<FormatInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_format(inputs)
	return zh_format(inputs)
});
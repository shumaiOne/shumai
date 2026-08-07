/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Font_SizeInputs */

const en_font_size = /** @type {(inputs: Font_SizeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Font Size`)
};

const zh_font_size = /** @type {(inputs: Font_SizeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`字体大小`)
};

/**
* | output |
* | --- |
* | "Font Size" |
*
* @param {Font_SizeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const font_size = /** @type {((inputs?: Font_SizeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Font_SizeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_font_size(inputs)
	return zh_font_size(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ColorInputs */

const en_color = /** @type {(inputs: ColorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Color`)
};

const zh_color = /** @type {(inputs: ColorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`颜色`)
};

/**
* | output |
* | --- |
* | "Color" |
*
* @param {ColorInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const color = /** @type {((inputs?: ColorInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ColorInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_color(inputs)
	return zh_color(inputs)
});
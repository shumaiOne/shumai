/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Aspect_RatioInputs */

const en_aspect_ratio = /** @type {(inputs: Aspect_RatioInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Aspect Ratio`)
};

const zh_aspect_ratio = /** @type {(inputs: Aspect_RatioInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`宽高比`)
};

/**
* | output |
* | --- |
* | "Aspect Ratio" |
*
* @param {Aspect_RatioInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const aspect_ratio = /** @type {((inputs?: Aspect_RatioInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Aspect_RatioInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_aspect_ratio(inputs)
	return zh_aspect_ratio(inputs)
});
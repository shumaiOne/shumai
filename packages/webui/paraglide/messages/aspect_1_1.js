/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Aspect_1_1Inputs */

const en_aspect_1_1 = /** @type {(inputs: Aspect_1_1Inputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`1:1 Square`)
};

const zh_aspect_1_1 = /** @type {(inputs: Aspect_1_1Inputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`1:1 正方形`)
};

/**
* | output |
* | --- |
* | "1:1 Square" |
*
* @param {Aspect_1_1Inputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const aspect_1_1 = /** @type {((inputs?: Aspect_1_1Inputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Aspect_1_1Inputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_aspect_1_1(inputs)
	return zh_aspect_1_1(inputs)
});
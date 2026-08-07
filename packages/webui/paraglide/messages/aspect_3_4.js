/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Aspect_3_4Inputs */

const en_aspect_3_4 = /** @type {(inputs: Aspect_3_4Inputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`3:4 Portrait`)
};

const zh_aspect_3_4 = /** @type {(inputs: Aspect_3_4Inputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`3:4 肖像`)
};

/**
* | output |
* | --- |
* | "3:4 Portrait" |
*
* @param {Aspect_3_4Inputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const aspect_3_4 = /** @type {((inputs?: Aspect_3_4Inputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Aspect_3_4Inputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_aspect_3_4(inputs)
	return zh_aspect_3_4(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Aspect_4_3Inputs */

const en_aspect_4_3 = /** @type {(inputs: Aspect_4_3Inputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`4:3 Standard`)
};

const zh_aspect_4_3 = /** @type {(inputs: Aspect_4_3Inputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`4:3 标准`)
};

/**
* | output |
* | --- |
* | "4:3 Standard" |
*
* @param {Aspect_4_3Inputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const aspect_4_3 = /** @type {((inputs?: Aspect_4_3Inputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Aspect_4_3Inputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_aspect_4_3(inputs)
	return zh_aspect_4_3(inputs)
});
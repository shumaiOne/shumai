/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Aspect_16_9Inputs */

const en_aspect_16_9 = /** @type {(inputs: Aspect_16_9Inputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`16:9 Widescreen`)
};

const zh_aspect_16_9 = /** @type {(inputs: Aspect_16_9Inputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`16:9 横屏`)
};

/**
* | output |
* | --- |
* | "16:9 Widescreen" |
*
* @param {Aspect_16_9Inputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const aspect_16_9 = /** @type {((inputs?: Aspect_16_9Inputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Aspect_16_9Inputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_aspect_16_9(inputs)
	return zh_aspect_16_9(inputs)
});
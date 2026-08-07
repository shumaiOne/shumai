/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Aspect_9_16Inputs */

const en_aspect_9_16 = /** @type {(inputs: Aspect_9_16Inputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`9:16 Vertical`)
};

const zh_aspect_9_16 = /** @type {(inputs: Aspect_9_16Inputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`9:16 竖屏`)
};

/**
* | output |
* | --- |
* | "9:16 Vertical" |
*
* @param {Aspect_9_16Inputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const aspect_9_16 = /** @type {((inputs?: Aspect_9_16Inputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Aspect_9_16Inputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_aspect_9_16(inputs)
	return zh_aspect_9_16(inputs)
});
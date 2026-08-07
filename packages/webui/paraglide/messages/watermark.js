/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} WatermarkInputs */

const en_watermark = /** @type {(inputs: WatermarkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Watermark`)
};

const zh_watermark = /** @type {(inputs: WatermarkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`水印`)
};

/**
* | output |
* | --- |
* | "Watermark" |
*
* @param {WatermarkInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const watermark = /** @type {((inputs?: WatermarkInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<WatermarkInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_watermark(inputs)
	return zh_watermark(inputs)
});
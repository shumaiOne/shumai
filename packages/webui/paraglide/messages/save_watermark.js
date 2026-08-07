/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Save_WatermarkInputs */

const en_save_watermark = /** @type {(inputs: Save_WatermarkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Save Watermark`)
};

const zh_save_watermark = /** @type {(inputs: Save_WatermarkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`保存水印`)
};

/**
* | output |
* | --- |
* | "Save Watermark" |
*
* @param {Save_WatermarkInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const save_watermark = /** @type {((inputs?: Save_WatermarkInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Save_WatermarkInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_save_watermark(inputs)
	return zh_save_watermark(inputs)
});
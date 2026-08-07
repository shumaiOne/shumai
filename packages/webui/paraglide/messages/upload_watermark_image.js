/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Upload_Watermark_ImageInputs */

const en_upload_watermark_image = /** @type {(inputs: Upload_Watermark_ImageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Upload Watermark Image`)
};

const zh_upload_watermark_image = /** @type {(inputs: Upload_Watermark_ImageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`上传水印图片`)
};

/**
* | output |
* | --- |
* | "Upload Watermark Image" |
*
* @param {Upload_Watermark_ImageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const upload_watermark_image = /** @type {((inputs?: Upload_Watermark_ImageInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Upload_Watermark_ImageInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_upload_watermark_image(inputs)
	return zh_upload_watermark_image(inputs)
});
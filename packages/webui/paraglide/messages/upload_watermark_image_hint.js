/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Upload_Watermark_Image_HintInputs */

const en_upload_watermark_image_hint = /** @type {(inputs: Upload_Watermark_Image_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Drag and drop, or browse. Max 1MB.`)
};

const zh_upload_watermark_image_hint = /** @type {(inputs: Upload_Watermark_Image_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`拖放或浏览文件。最大 1MB。`)
};

/**
* | output |
* | --- |
* | "Drag and drop, or browse. Max 1MB." |
*
* @param {Upload_Watermark_Image_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const upload_watermark_image_hint = /** @type {((inputs?: Upload_Watermark_Image_HintInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Upload_Watermark_Image_HintInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_upload_watermark_image_hint(inputs)
	return zh_upload_watermark_image_hint(inputs)
});
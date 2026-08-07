/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Watermark_Transcoding_ProcessingInputs */

const en_watermark_transcoding_processing = /** @type {(inputs: Watermark_Transcoding_ProcessingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Transcoding watermark media...`)
};

const zh_watermark_transcoding_processing = /** @type {(inputs: Watermark_Transcoding_ProcessingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`水印媒体转码处理中...`)
};

/**
* | output |
* | --- |
* | "Transcoding watermark media..." |
*
* @param {Watermark_Transcoding_ProcessingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const watermark_transcoding_processing = /** @type {((inputs?: Watermark_Transcoding_ProcessingInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Watermark_Transcoding_ProcessingInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_watermark_transcoding_processing(inputs)
	return zh_watermark_transcoding_processing(inputs)
});
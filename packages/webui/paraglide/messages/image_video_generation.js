/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Image_Video_GenerationInputs */

const en_image_video_generation = /** @type {(inputs: Image_Video_GenerationInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Image / Video Generation`)
};

const zh_image_video_generation = /** @type {(inputs: Image_Video_GenerationInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`图像与视频生成`)
};

/**
* | output |
* | --- |
* | "Image / Video Generation" |
*
* @param {Image_Video_GenerationInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const image_video_generation = /** @type {((inputs?: Image_Video_GenerationInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Image_Video_GenerationInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_image_video_generation(inputs)
	return zh_image_video_generation(inputs)
});
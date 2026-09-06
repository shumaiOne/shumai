/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Media_Type_ImageInputs */

const en_media_type_image = /** @type {(inputs: Media_Type_ImageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Image`)
};

const zh_media_type_image = /** @type {(inputs: Media_Type_ImageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`图像`)
};

/**
* | output |
* | --- |
* | "Image" |
*
* @param {Media_Type_ImageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const media_type_image = /** @type {((inputs?: Media_Type_ImageInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Media_Type_ImageInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_media_type_image(inputs)
	return zh_media_type_image(inputs)
});
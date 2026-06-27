/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Upload_ImageInputs */

const en_upload_image = /** @type {(inputs: Upload_ImageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Upload Image`)
};

const zh_upload_image = /** @type {(inputs: Upload_ImageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`上传图片`)
};

/**
* | output |
* | --- |
* | "Upload Image" |
*
* @param {Upload_ImageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const upload_image = /** @type {((inputs?: Upload_ImageInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Upload_ImageInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_upload_image(inputs)
	return zh_upload_image(inputs)
});
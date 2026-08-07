/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Image_SizeInputs */

const en_image_size = /** @type {(inputs: Image_SizeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Image Size`)
};

const zh_image_size = /** @type {(inputs: Image_SizeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`图片大小`)
};

/**
* | output |
* | --- |
* | "Image Size" |
*
* @param {Image_SizeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const image_size = /** @type {((inputs?: Image_SizeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Image_SizeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_image_size(inputs)
	return zh_image_size(inputs)
});
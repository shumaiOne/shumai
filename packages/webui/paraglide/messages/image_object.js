/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Image_ObjectInputs */

const en_image_object = /** @type {(inputs: Image_ObjectInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`[Image Object]`)
};

const zh_image_object = /** @type {(inputs: Image_ObjectInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`[图片对象]`)
};

/**
* | output |
* | --- |
* | "[Image Object]" |
*
* @param {Image_ObjectInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const image_object = /** @type {((inputs?: Image_ObjectInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Image_ObjectInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_image_object(inputs)
	return zh_image_object(inputs)
});
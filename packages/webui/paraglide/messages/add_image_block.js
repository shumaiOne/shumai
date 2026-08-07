/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Image_BlockInputs */

const en_add_image_block = /** @type {(inputs: Add_Image_BlockInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Add Image Block`)
};

const zh_add_image_block = /** @type {(inputs: Add_Image_BlockInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`添加图片块`)
};

/**
* | output |
* | --- |
* | "Add Image Block" |
*
* @param {Add_Image_BlockInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_image_block = /** @type {((inputs?: Add_Image_BlockInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Image_BlockInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_add_image_block(inputs)
	return zh_add_image_block(inputs)
});
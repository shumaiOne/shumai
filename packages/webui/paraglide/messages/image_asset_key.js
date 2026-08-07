/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Image_Asset_KeyInputs */

const en_image_asset_key = /** @type {(inputs: Image_Asset_KeyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Image Asset`)
};

const zh_image_asset_key = /** @type {(inputs: Image_Asset_KeyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`图片资源`)
};

/**
* | output |
* | --- |
* | "Image Asset" |
*
* @param {Image_Asset_KeyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const image_asset_key = /** @type {((inputs?: Image_Asset_KeyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Image_Asset_KeyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_image_asset_key(inputs)
	return zh_image_asset_key(inputs)
});
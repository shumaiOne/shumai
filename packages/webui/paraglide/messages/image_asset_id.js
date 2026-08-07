/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Image_Asset_IdInputs */

const en_image_asset_id = /** @type {(inputs: Image_Asset_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Image Asset ID`)
};

const zh_image_asset_id = /** @type {(inputs: Image_Asset_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`图片资源 ID`)
};

/**
* | output |
* | --- |
* | "Image Asset ID" |
*
* @param {Image_Asset_IdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const image_asset_id = /** @type {((inputs?: Image_Asset_IdInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Image_Asset_IdInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_image_asset_id(inputs)
	return zh_image_asset_id(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Image_Models_CountInputs */

const en_image_models_count = /** @type {(inputs: Image_Models_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} enabled`)
};

const zh_image_models_count = /** @type {(inputs: Image_Models_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} 个已启用`)
};

/**
* | output |
* | --- |
* | "{count} enabled" |
*
* @param {Image_Models_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const image_models_count = /** @type {((inputs: Image_Models_CountInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Image_Models_CountInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_image_models_count(inputs)
	return zh_image_models_count(inputs)
});
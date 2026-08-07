/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Edit_WatermarkInputs */

const en_edit_watermark = /** @type {(inputs: Edit_WatermarkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Edit Watermark`)
};

const zh_edit_watermark = /** @type {(inputs: Edit_WatermarkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`编辑水印`)
};

/**
* | output |
* | --- |
* | "Edit Watermark" |
*
* @param {Edit_WatermarkInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const edit_watermark = /** @type {((inputs?: Edit_WatermarkInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Edit_WatermarkInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_edit_watermark(inputs)
	return zh_edit_watermark(inputs)
});
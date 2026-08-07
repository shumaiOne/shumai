/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Watermark_UpdatedInputs */

const en_watermark_updated = /** @type {(inputs: Watermark_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Watermark updated successfully`)
};

const zh_watermark_updated = /** @type {(inputs: Watermark_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`水印更新成功`)
};

/**
* | output |
* | --- |
* | "Watermark updated successfully" |
*
* @param {Watermark_UpdatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const watermark_updated = /** @type {((inputs?: Watermark_UpdatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Watermark_UpdatedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_watermark_updated(inputs)
	return zh_watermark_updated(inputs)
});
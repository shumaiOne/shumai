/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Watermark_EnabledInputs */

const en_watermark_enabled = /** @type {(inputs: Watermark_EnabledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Enable Watermark`)
};

const zh_watermark_enabled = /** @type {(inputs: Watermark_EnabledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`启用水印`)
};

/**
* | output |
* | --- |
* | "Enable Watermark" |
*
* @param {Watermark_EnabledInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const watermark_enabled = /** @type {((inputs?: Watermark_EnabledInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Watermark_EnabledInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_watermark_enabled(inputs)
	return zh_watermark_enabled(inputs)
});
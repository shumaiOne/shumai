/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Watermark_TemplatesInputs */

const en_watermark_templates = /** @type {(inputs: Watermark_TemplatesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Templates`)
};

const zh_watermark_templates = /** @type {(inputs: Watermark_TemplatesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`水印模板`)
};

/**
* | output |
* | --- |
* | "Templates" |
*
* @param {Watermark_TemplatesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const watermark_templates = /** @type {((inputs?: Watermark_TemplatesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Watermark_TemplatesInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_watermark_templates(inputs)
	return zh_watermark_templates(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Watermark_BlocksInputs */

const en_no_watermark_blocks = /** @type {(inputs: No_Watermark_BlocksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No watermark blocks added yet`)
};

const zh_no_watermark_blocks = /** @type {(inputs: No_Watermark_BlocksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`尚未添加水印块`)
};

/**
* | output |
* | --- |
* | "No watermark blocks added yet" |
*
* @param {No_Watermark_BlocksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_watermark_blocks = /** @type {((inputs?: No_Watermark_BlocksInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Watermark_BlocksInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_watermark_blocks(inputs)
	return zh_no_watermark_blocks(inputs)
});
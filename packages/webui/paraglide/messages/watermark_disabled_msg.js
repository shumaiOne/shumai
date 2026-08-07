/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Watermark_Disabled_MsgInputs */

const en_watermark_disabled_msg = /** @type {(inputs: Watermark_Disabled_MsgInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Watermark disabled`)
};

const zh_watermark_disabled_msg = /** @type {(inputs: Watermark_Disabled_MsgInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`水印已禁用`)
};

/**
* | output |
* | --- |
* | "Watermark disabled" |
*
* @param {Watermark_Disabled_MsgInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const watermark_disabled_msg = /** @type {((inputs?: Watermark_Disabled_MsgInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Watermark_Disabled_MsgInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_watermark_disabled_msg(inputs)
	return zh_watermark_disabled_msg(inputs)
});
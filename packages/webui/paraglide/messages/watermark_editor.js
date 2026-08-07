/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Watermark_EditorInputs */

const en_watermark_editor = /** @type {(inputs: Watermark_EditorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Watermark Editor`)
};

const zh_watermark_editor = /** @type {(inputs: Watermark_EditorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`水印编辑器`)
};

/**
* | output |
* | --- |
* | "Watermark Editor" |
*
* @param {Watermark_EditorInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const watermark_editor = /** @type {((inputs?: Watermark_EditorInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Watermark_EditorInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_watermark_editor(inputs)
	return zh_watermark_editor(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Copied_To_ClipboardInputs */

const en_copied_to_clipboard = /** @type {(inputs: Copied_To_ClipboardInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Copied to clipboard`)
};

const zh_copied_to_clipboard = /** @type {(inputs: Copied_To_ClipboardInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已复制到剪贴板`)
};

/**
* | output |
* | --- |
* | "Copied to clipboard" |
*
* @param {Copied_To_ClipboardInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const copied_to_clipboard = /** @type {((inputs?: Copied_To_ClipboardInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Copied_To_ClipboardInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_copied_to_clipboard(inputs)
	return zh_copied_to_clipboard(inputs)
});
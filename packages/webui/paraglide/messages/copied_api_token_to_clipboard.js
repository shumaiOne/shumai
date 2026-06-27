/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Copied_Api_Token_To_ClipboardInputs */

const en_copied_api_token_to_clipboard = /** @type {(inputs: Copied_Api_Token_To_ClipboardInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Copied API token to clipboard`)
};

const zh_copied_api_token_to_clipboard = /** @type {(inputs: Copied_Api_Token_To_ClipboardInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已将 API 令牌复制到剪贴板`)
};

/**
* | output |
* | --- |
* | "Copied API token to clipboard" |
*
* @param {Copied_Api_Token_To_ClipboardInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const copied_api_token_to_clipboard = /** @type {((inputs?: Copied_Api_Token_To_ClipboardInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Copied_Api_Token_To_ClipboardInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_copied_api_token_to_clipboard(inputs)
	return zh_copied_api_token_to_clipboard(inputs)
});
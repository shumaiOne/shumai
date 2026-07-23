/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Input_TokensInputs */

const en_input_tokens = /** @type {(inputs: Input_TokensInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Input Tokens`)
};

const zh_input_tokens = /** @type {(inputs: Input_TokensInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`输入 Token`)
};

/**
* | output |
* | --- |
* | "Input Tokens" |
*
* @param {Input_TokensInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const input_tokens = /** @type {((inputs?: Input_TokensInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Input_TokensInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_input_tokens(inputs)
	return zh_input_tokens(inputs)
});
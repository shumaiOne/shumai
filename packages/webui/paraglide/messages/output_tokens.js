/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Output_TokensInputs */

const en_output_tokens = /** @type {(inputs: Output_TokensInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Output Tokens`)
};

const zh_output_tokens = /** @type {(inputs: Output_TokensInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`输出 Token`)
};

/**
* | output |
* | --- |
* | "Output Tokens" |
*
* @param {Output_TokensInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const output_tokens = /** @type {((inputs?: Output_TokensInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Output_TokensInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_output_tokens(inputs)
	return zh_output_tokens(inputs)
});
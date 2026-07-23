/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Total_TokensInputs */

const en_total_tokens = /** @type {(inputs: Total_TokensInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Total Tokens`)
};

const zh_total_tokens = /** @type {(inputs: Total_TokensInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`总 Token`)
};

/**
* | output |
* | --- |
* | "Total Tokens" |
*
* @param {Total_TokensInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const total_tokens = /** @type {((inputs?: Total_TokensInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Total_TokensInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_total_tokens(inputs)
	return zh_total_tokens(inputs)
});
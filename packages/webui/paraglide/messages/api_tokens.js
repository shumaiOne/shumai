/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Api_TokensInputs */

const en_api_tokens = /** @type {(inputs: Api_TokensInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`API Tokens`)
};

const zh_api_tokens = /** @type {(inputs: Api_TokensInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`API 令牌`)
};

/**
* | output |
* | --- |
* | "API Tokens" |
*
* @param {Api_TokensInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const api_tokens = /** @type {((inputs?: Api_TokensInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Api_TokensInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_api_tokens(inputs)
	return zh_api_tokens(inputs)
});
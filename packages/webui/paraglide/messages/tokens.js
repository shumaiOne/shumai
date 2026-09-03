/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} TokensInputs */

const en_tokens = /** @type {(inputs: TokensInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`tokens`)
};

const zh_tokens = /** @type {(inputs: TokensInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`令牌`)
};

/**
* | output |
* | --- |
* | "tokens" |
*
* @param {TokensInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const tokens = /** @type {((inputs?: TokensInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<TokensInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_tokens(inputs)
	return zh_tokens(inputs)
});
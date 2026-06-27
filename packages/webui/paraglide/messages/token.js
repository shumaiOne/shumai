/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} TokenInputs */

const en_token = /** @type {(inputs: TokenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Token`)
};

const zh_token = /** @type {(inputs: TokenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`令牌`)
};

/**
* | output |
* | --- |
* | "Token" |
*
* @param {TokenInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const token = /** @type {((inputs?: TokenInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<TokenInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_token(inputs)
	return zh_token(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Invalid_Reset_TokenInputs */

const en_invalid_reset_token = /** @type {(inputs: Invalid_Reset_TokenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Invalid or missing reset token.`)
};

const zh_invalid_reset_token = /** @type {(inputs: Invalid_Reset_TokenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`无效或缺失的重置令牌。`)
};

/**
* | output |
* | --- |
* | "Invalid or missing reset token." |
*
* @param {Invalid_Reset_TokenInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const invalid_reset_token = /** @type {((inputs?: Invalid_Reset_TokenInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Invalid_Reset_TokenInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_invalid_reset_token(inputs)
	return zh_invalid_reset_token(inputs)
});
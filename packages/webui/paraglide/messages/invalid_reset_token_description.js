/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Invalid_Reset_Token_DescriptionInputs */

const en_invalid_reset_token_description = /** @type {(inputs: Invalid_Reset_Token_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Please contact your administrator to generate a new password reset link.`)
};

const zh_invalid_reset_token_description = /** @type {(inputs: Invalid_Reset_Token_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`请联系管理员生成新的密码重置链接。`)
};

/**
* | output |
* | --- |
* | "Please contact your administrator to generate a new password reset link." |
*
* @param {Invalid_Reset_Token_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const invalid_reset_token_description = /** @type {((inputs?: Invalid_Reset_Token_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Invalid_Reset_Token_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_invalid_reset_token_description(inputs)
	return zh_invalid_reset_token_description(inputs)
});
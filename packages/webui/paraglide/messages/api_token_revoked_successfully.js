/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Api_Token_Revoked_SuccessfullyInputs */

const en_api_token_revoked_successfully = /** @type {(inputs: Api_Token_Revoked_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`API token revoked successfully`)
};

const zh_api_token_revoked_successfully = /** @type {(inputs: Api_Token_Revoked_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`API 令牌已成功撤销`)
};

/**
* | output |
* | --- |
* | "API token revoked successfully" |
*
* @param {Api_Token_Revoked_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const api_token_revoked_successfully = /** @type {((inputs?: Api_Token_Revoked_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Api_Token_Revoked_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_api_token_revoked_successfully(inputs)
	return zh_api_token_revoked_successfully(inputs)
});
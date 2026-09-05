/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Api_Key_Saved_SuccessfullyInputs */

const en_api_key_saved_successfully = /** @type {(inputs: Api_Key_Saved_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`API key updated successfully`)
};

const zh_api_key_saved_successfully = /** @type {(inputs: Api_Key_Saved_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`API 密钥更新成功`)
};

/**
* | output |
* | --- |
* | "API key updated successfully" |
*
* @param {Api_Key_Saved_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const api_key_saved_successfully = /** @type {((inputs?: Api_Key_Saved_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Api_Key_Saved_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_api_key_saved_successfully(inputs)
	return zh_api_key_saved_successfully(inputs)
});
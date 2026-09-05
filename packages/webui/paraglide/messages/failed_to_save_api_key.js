/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_Save_Api_KeyInputs */

const en_failed_to_save_api_key = /** @type {(inputs: Failed_To_Save_Api_KeyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to update API key`)
};

const zh_failed_to_save_api_key = /** @type {(inputs: Failed_To_Save_Api_KeyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`更新 API 密钥失败`)
};

/**
* | output |
* | --- |
* | "Failed to update API key" |
*
* @param {Failed_To_Save_Api_KeyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_save_api_key = /** @type {((inputs?: Failed_To_Save_Api_KeyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_Save_Api_KeyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_to_save_api_key(inputs)
	return zh_failed_to_save_api_key(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Configure_Api_KeyInputs */

const en_configure_api_key = /** @type {(inputs: Configure_Api_KeyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Configure API Key`)
};

const zh_configure_api_key = /** @type {(inputs: Configure_Api_KeyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`配置 API 密钥`)
};

/**
* | output |
* | --- |
* | "Configure API Key" |
*
* @param {Configure_Api_KeyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const configure_api_key = /** @type {((inputs?: Configure_Api_KeyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Configure_Api_KeyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_configure_api_key(inputs)
	return zh_configure_api_key(inputs)
});
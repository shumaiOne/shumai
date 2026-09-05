/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Model_Requires_Api_Key_WarningInputs */

const en_model_requires_api_key_warning = /** @type {(inputs: Model_Requires_Api_Key_WarningInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This provider is not configured. Tools using this model will not be available until an API key is configured.`)
};

const zh_model_requires_api_key_warning = /** @type {(inputs: Model_Requires_Api_Key_WarningInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`此提供商尚未配置。在配置 API 密钥之前，使用此模型的工具将不可用。`)
};

/**
* | output |
* | --- |
* | "This provider is not configured. Tools using this model will not be available until an API key is configured." |
*
* @param {Model_Requires_Api_Key_WarningInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const model_requires_api_key_warning = /** @type {((inputs?: Model_Requires_Api_Key_WarningInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Model_Requires_Api_Key_WarningInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_model_requires_api_key_warning(inputs)
	return zh_model_requires_api_key_warning(inputs)
});
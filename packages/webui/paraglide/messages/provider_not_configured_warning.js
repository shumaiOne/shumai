/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Provider_Not_Configured_WarningInputs */

const en_provider_not_configured_warning = /** @type {(inputs: Provider_Not_Configured_WarningInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This provider is not configured. Configure an API key in the API Key tab before using these models.`)
};

const zh_provider_not_configured_warning = /** @type {(inputs: Provider_Not_Configured_WarningInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`此提供商尚未配置。在使用这些模型前，请在 API 密钥标签页中配置密钥。`)
};

/**
* | output |
* | --- |
* | "This provider is not configured. Configure an API key in the API Key tab before using these models." |
*
* @param {Provider_Not_Configured_WarningInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const provider_not_configured_warning = /** @type {((inputs?: Provider_Not_Configured_WarningInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Provider_Not_Configured_WarningInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_provider_not_configured_warning(inputs)
	return zh_provider_not_configured_warning(inputs)
});
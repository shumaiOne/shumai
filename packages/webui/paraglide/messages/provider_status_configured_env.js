/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Provider_Status_Configured_EnvInputs */

const en_provider_status_configured_env = /** @type {(inputs: Provider_Status_Configured_EnvInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Configured (Environment)`)
};

const zh_provider_status_configured_env = /** @type {(inputs: Provider_Status_Configured_EnvInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已配置（环境变量）`)
};

/**
* | output |
* | --- |
* | "Configured (Environment)" |
*
* @param {Provider_Status_Configured_EnvInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const provider_status_configured_env = /** @type {((inputs?: Provider_Status_Configured_EnvInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Provider_Status_Configured_EnvInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_provider_status_configured_env(inputs)
	return zh_provider_status_configured_env(inputs)
});
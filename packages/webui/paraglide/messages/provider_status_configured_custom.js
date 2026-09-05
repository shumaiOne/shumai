/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Provider_Status_Configured_CustomInputs */

const en_provider_status_configured_custom = /** @type {(inputs: Provider_Status_Configured_CustomInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Configured (Custom)`)
};

const zh_provider_status_configured_custom = /** @type {(inputs: Provider_Status_Configured_CustomInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已配置（自定义）`)
};

/**
* | output |
* | --- |
* | "Configured (Custom)" |
*
* @param {Provider_Status_Configured_CustomInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const provider_status_configured_custom = /** @type {((inputs?: Provider_Status_Configured_CustomInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Provider_Status_Configured_CustomInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_provider_status_configured_custom(inputs)
	return zh_provider_status_configured_custom(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Provider_Status_Not_ConfiguredInputs */

const en_provider_status_not_configured = /** @type {(inputs: Provider_Status_Not_ConfiguredInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Not Configured`)
};

const zh_provider_status_not_configured = /** @type {(inputs: Provider_Status_Not_ConfiguredInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未配置`)
};

/**
* | output |
* | --- |
* | "Not Configured" |
*
* @param {Provider_Status_Not_ConfiguredInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const provider_status_not_configured = /** @type {((inputs?: Provider_Status_Not_ConfiguredInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Provider_Status_Not_ConfiguredInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_provider_status_not_configured(inputs)
	return zh_provider_status_not_configured(inputs)
});
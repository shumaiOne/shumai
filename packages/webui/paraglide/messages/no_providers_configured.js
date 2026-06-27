/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Providers_ConfiguredInputs */

const en_no_providers_configured = /** @type {(inputs: No_Providers_ConfiguredInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No Providers Configured`)
};

const zh_no_providers_configured = /** @type {(inputs: No_Providers_ConfiguredInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`暂无已配置的提供商`)
};

/**
* | output |
* | --- |
* | "No Providers Configured" |
*
* @param {No_Providers_ConfiguredInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_providers_configured = /** @type {((inputs?: No_Providers_ConfiguredInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Providers_ConfiguredInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_providers_configured(inputs)
	return zh_no_providers_configured(inputs)
});
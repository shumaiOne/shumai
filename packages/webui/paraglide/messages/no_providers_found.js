/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Providers_FoundInputs */

const en_no_providers_found = /** @type {(inputs: No_Providers_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No providers found`)
};

const zh_no_providers_found = /** @type {(inputs: No_Providers_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未找到提供商`)
};

/**
* | output |
* | --- |
* | "No providers found" |
*
* @param {No_Providers_FoundInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_providers_found = /** @type {((inputs?: No_Providers_FoundInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Providers_FoundInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_providers_found(inputs)
	return zh_no_providers_found(inputs)
});
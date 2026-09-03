/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sync_Providers_New_ProviderInputs */

const en_sync_providers_new_provider = /** @type {(inputs: Sync_Providers_New_ProviderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`New Provider`)
};

const zh_sync_providers_new_provider = /** @type {(inputs: Sync_Providers_New_ProviderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`新提供商`)
};

/**
* | output |
* | --- |
* | "New Provider" |
*
* @param {Sync_Providers_New_ProviderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_new_provider = /** @type {((inputs?: Sync_Providers_New_ProviderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sync_Providers_New_ProviderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sync_providers_new_provider(inputs)
	return zh_sync_providers_new_provider(inputs)
});
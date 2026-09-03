/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sync_Providers_Existing_ProviderInputs */

const en_sync_providers_existing_provider = /** @type {(inputs: Sync_Providers_Existing_ProviderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Existing Provider`)
};

const zh_sync_providers_existing_provider = /** @type {(inputs: Sync_Providers_Existing_ProviderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`现有提供商`)
};

/**
* | output |
* | --- |
* | "Existing Provider" |
*
* @param {Sync_Providers_Existing_ProviderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_existing_provider = /** @type {((inputs?: Sync_Providers_Existing_ProviderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sync_Providers_Existing_ProviderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sync_providers_existing_provider(inputs)
	return zh_sync_providers_existing_provider(inputs)
});
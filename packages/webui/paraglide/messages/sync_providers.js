/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sync_ProvidersInputs */

const en_sync_providers = /** @type {(inputs: Sync_ProvidersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sync Providers`)
};

const zh_sync_providers = /** @type {(inputs: Sync_ProvidersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`同步提供商`)
};

/**
* | output |
* | --- |
* | "Sync Providers" |
*
* @param {Sync_ProvidersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers = /** @type {((inputs?: Sync_ProvidersInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sync_ProvidersInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sync_providers(inputs)
	return zh_sync_providers(inputs)
});
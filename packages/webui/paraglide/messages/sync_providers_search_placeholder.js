/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sync_Providers_Search_PlaceholderInputs */

const en_sync_providers_search_placeholder = /** @type {(inputs: Sync_Providers_Search_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Filter new providers or models...`)
};

const zh_sync_providers_search_placeholder = /** @type {(inputs: Sync_Providers_Search_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`筛选新提供商或模型...`)
};

/**
* | output |
* | --- |
* | "Filter new providers or models..." |
*
* @param {Sync_Providers_Search_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_search_placeholder = /** @type {((inputs?: Sync_Providers_Search_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sync_Providers_Search_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sync_providers_search_placeholder(inputs)
	return zh_sync_providers_search_placeholder(inputs)
});
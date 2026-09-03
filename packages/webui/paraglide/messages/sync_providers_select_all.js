/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sync_Providers_Select_AllInputs */

const en_sync_providers_select_all = /** @type {(inputs: Sync_Providers_Select_AllInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select All`)
};

const zh_sync_providers_select_all = /** @type {(inputs: Sync_Providers_Select_AllInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`全选`)
};

/**
* | output |
* | --- |
* | "Select All" |
*
* @param {Sync_Providers_Select_AllInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_select_all = /** @type {((inputs?: Sync_Providers_Select_AllInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sync_Providers_Select_AllInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sync_providers_select_all(inputs)
	return zh_sync_providers_select_all(inputs)
});
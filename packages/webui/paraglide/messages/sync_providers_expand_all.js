/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sync_Providers_Expand_AllInputs */

const en_sync_providers_expand_all = /** @type {(inputs: Sync_Providers_Expand_AllInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Expand All`)
};

const zh_sync_providers_expand_all = /** @type {(inputs: Sync_Providers_Expand_AllInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`全部展开`)
};

/**
* | output |
* | --- |
* | "Expand All" |
*
* @param {Sync_Providers_Expand_AllInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_expand_all = /** @type {((inputs?: Sync_Providers_Expand_AllInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sync_Providers_Expand_AllInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sync_providers_expand_all(inputs)
	return zh_sync_providers_expand_all(inputs)
});
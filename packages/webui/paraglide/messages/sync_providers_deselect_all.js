/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sync_Providers_Deselect_AllInputs */

const en_sync_providers_deselect_all = /** @type {(inputs: Sync_Providers_Deselect_AllInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Deselect All`)
};

const zh_sync_providers_deselect_all = /** @type {(inputs: Sync_Providers_Deselect_AllInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`取消全选`)
};

/**
* | output |
* | --- |
* | "Deselect All" |
*
* @param {Sync_Providers_Deselect_AllInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_deselect_all = /** @type {((inputs?: Sync_Providers_Deselect_AllInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sync_Providers_Deselect_AllInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sync_providers_deselect_all(inputs)
	return zh_sync_providers_deselect_all(inputs)
});
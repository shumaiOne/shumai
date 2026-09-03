/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ modelCount: NonNullable<unknown>, providerCount: NonNullable<unknown> }} Sync_Providers_Selected_CountInputs */

const en_sync_providers_selected_count = /** @type {(inputs: Sync_Providers_Selected_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.modelCount} models selected across ${i?.providerCount} providers`)
};

const zh_sync_providers_selected_count = /** @type {(inputs: Sync_Providers_Selected_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`已选 ${i?.providerCount} 个提供商中的 ${i?.modelCount} 个模型`)
};

/**
* | output |
* | --- |
* | "{modelCount} models selected across {providerCount} providers" |
*
* @param {Sync_Providers_Selected_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_selected_count = /** @type {((inputs: Sync_Providers_Selected_CountInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sync_Providers_Selected_CountInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sync_providers_selected_count(inputs)
	return zh_sync_providers_selected_count(inputs)
});
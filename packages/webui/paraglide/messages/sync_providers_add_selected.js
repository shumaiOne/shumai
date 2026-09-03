/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Sync_Providers_Add_SelectedInputs */

const en_sync_providers_add_selected = /** @type {(inputs: Sync_Providers_Add_SelectedInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Add Selected (${i?.count})`)
};

const zh_sync_providers_add_selected = /** @type {(inputs: Sync_Providers_Add_SelectedInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`添加所选 (${i?.count})`)
};

/**
* | output |
* | --- |
* | "Add Selected ({count})" |
*
* @param {Sync_Providers_Add_SelectedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_add_selected = /** @type {((inputs: Sync_Providers_Add_SelectedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sync_Providers_Add_SelectedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sync_providers_add_selected(inputs)
	return zh_sync_providers_add_selected(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Sync_Providers_New_Models_CountInputs */

const en_sync_providers_new_models_count = /** @type {(inputs: Sync_Providers_New_Models_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} new models`)
};

const zh_sync_providers_new_models_count = /** @type {(inputs: Sync_Providers_New_Models_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} 个新模型`)
};

/**
* | output |
* | --- |
* | "{count} new models" |
*
* @param {Sync_Providers_New_Models_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_new_models_count = /** @type {((inputs: Sync_Providers_New_Models_CountInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sync_Providers_New_Models_CountInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sync_providers_new_models_count(inputs)
	return zh_sync_providers_new_models_count(inputs)
});
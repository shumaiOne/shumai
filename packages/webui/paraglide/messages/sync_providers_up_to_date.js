/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sync_Providers_Up_To_DateInputs */

const en_sync_providers_up_to_date = /** @type {(inputs: Sync_Providers_Up_To_DateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`All providers and models are already up to date.`)
};

const zh_sync_providers_up_to_date = /** @type {(inputs: Sync_Providers_Up_To_DateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`所有提供商和模型均已是最新状态。`)
};

/**
* | output |
* | --- |
* | "All providers and models are already up to date." |
*
* @param {Sync_Providers_Up_To_DateInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_up_to_date = /** @type {((inputs?: Sync_Providers_Up_To_DateInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sync_Providers_Up_To_DateInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sync_providers_up_to_date(inputs)
	return zh_sync_providers_up_to_date(inputs)
});
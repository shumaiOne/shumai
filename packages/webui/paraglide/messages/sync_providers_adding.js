/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sync_Providers_AddingInputs */

const en_sync_providers_adding = /** @type {(inputs: Sync_Providers_AddingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Adding...`)
};

const zh_sync_providers_adding = /** @type {(inputs: Sync_Providers_AddingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`正在添加...`)
};

/**
* | output |
* | --- |
* | "Adding..." |
*
* @param {Sync_Providers_AddingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_adding = /** @type {((inputs?: Sync_Providers_AddingInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sync_Providers_AddingInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sync_providers_adding(inputs)
	return zh_sync_providers_adding(inputs)
});
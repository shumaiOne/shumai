/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sync_Providers_CheckingInputs */

const en_sync_providers_checking = /** @type {(inputs: Sync_Providers_CheckingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Checking for updates...`)
};

const zh_sync_providers_checking = /** @type {(inputs: Sync_Providers_CheckingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`正在检查更新...`)
};

/**
* | output |
* | --- |
* | "Checking for updates..." |
*
* @param {Sync_Providers_CheckingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_checking = /** @type {((inputs?: Sync_Providers_CheckingInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sync_Providers_CheckingInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sync_providers_checking(inputs)
	return zh_sync_providers_checking(inputs)
});
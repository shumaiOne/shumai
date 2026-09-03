/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sync_Providers_Dialog_TitleInputs */

const en_sync_providers_dialog_title = /** @type {(inputs: Sync_Providers_Dialog_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sync Providers & Models`)
};

const zh_sync_providers_dialog_title = /** @type {(inputs: Sync_Providers_Dialog_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`同步提供商与模型`)
};

/**
* | output |
* | --- |
* | "Sync Providers & Models" |
*
* @param {Sync_Providers_Dialog_TitleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_dialog_title = /** @type {((inputs?: Sync_Providers_Dialog_TitleInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sync_Providers_Dialog_TitleInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sync_providers_dialog_title(inputs)
	return zh_sync_providers_dialog_title(inputs)
});
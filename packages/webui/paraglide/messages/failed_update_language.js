/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Update_LanguageInputs */

const en_failed_update_language = /** @type {(inputs: Failed_Update_LanguageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to update language`)
};

const zh_failed_update_language = /** @type {(inputs: Failed_Update_LanguageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`语言更新失败`)
};

/**
* | output |
* | --- |
* | "Failed to update language" |
*
* @param {Failed_Update_LanguageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_update_language = /** @type {((inputs?: Failed_Update_LanguageInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Update_LanguageInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_update_language(inputs)
	return zh_failed_update_language(inputs)
});
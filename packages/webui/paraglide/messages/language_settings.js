/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Language_SettingsInputs */

const en_language_settings = /** @type {(inputs: Language_SettingsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Language Settings`)
};

const zh_language_settings = /** @type {(inputs: Language_SettingsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`语言设置`)
};

/**
* | output |
* | --- |
* | "Language Settings" |
*
* @param {Language_SettingsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const language_settings = /** @type {((inputs?: Language_SettingsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Language_SettingsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_language_settings(inputs)
	return zh_language_settings(inputs)
});
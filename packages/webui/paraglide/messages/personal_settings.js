/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Personal_SettingsInputs */

const en_personal_settings = /** @type {(inputs: Personal_SettingsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Personal Settings`)
};

const zh_personal_settings = /** @type {(inputs: Personal_SettingsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`个人设置`)
};

/**
* | output |
* | --- |
* | "Personal Settings" |
*
* @param {Personal_SettingsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const personal_settings = /** @type {((inputs?: Personal_SettingsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Personal_SettingsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_personal_settings(inputs)
	return zh_personal_settings(inputs)
});
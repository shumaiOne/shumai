/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Developer_SettingsInputs */

const en_developer_settings = /** @type {(inputs: Developer_SettingsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Developer Settings`)
};

const zh_developer_settings = /** @type {(inputs: Developer_SettingsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`开发者设置`)
};

/**
* | output |
* | --- |
* | "Developer Settings" |
*
* @param {Developer_SettingsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const developer_settings = /** @type {((inputs?: Developer_SettingsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Developer_SettingsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_developer_settings(inputs)
	return zh_developer_settings(inputs)
});
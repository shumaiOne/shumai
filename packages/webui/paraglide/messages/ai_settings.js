/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Ai_SettingsInputs */

const en_ai_settings = /** @type {(inputs: Ai_SettingsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AI Settings`)
};

const zh_ai_settings = /** @type {(inputs: Ai_SettingsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AI 设置`)
};

/**
* | output |
* | --- |
* | "AI Settings" |
*
* @param {Ai_SettingsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const ai_settings = /** @type {((inputs?: Ai_SettingsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Ai_SettingsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_ai_settings(inputs)
	return zh_ai_settings(inputs)
});
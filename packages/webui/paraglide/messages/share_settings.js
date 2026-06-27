/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Share_SettingsInputs */

const en_share_settings = /** @type {(inputs: Share_SettingsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Share Settings`)
};

const zh_share_settings = /** @type {(inputs: Share_SettingsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`分享设置`)
};

/**
* | output |
* | --- |
* | "Share Settings" |
*
* @param {Share_SettingsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const share_settings = /** @type {((inputs?: Share_SettingsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Share_SettingsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_share_settings(inputs)
	return zh_share_settings(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Reset_Password_SubtitleInputs */

const en_reset_password_subtitle = /** @type {(inputs: Reset_Password_SubtitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Enter your new password below.`)
};

const zh_reset_password_subtitle = /** @type {(inputs: Reset_Password_SubtitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`请在下方输入您的新密码。`)
};

/**
* | output |
* | --- |
* | "Enter your new password below." |
*
* @param {Reset_Password_SubtitleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const reset_password_subtitle = /** @type {((inputs?: Reset_Password_SubtitleInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Reset_Password_SubtitleInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_reset_password_subtitle(inputs)
	return zh_reset_password_subtitle(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Confirm_PasswordInputs */

const en_confirm_password = /** @type {(inputs: Confirm_PasswordInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Confirm Password`)
};

const zh_confirm_password = /** @type {(inputs: Confirm_PasswordInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`确认密码`)
};

/**
* | output |
* | --- |
* | "Confirm Password" |
*
* @param {Confirm_PasswordInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const confirm_password = /** @type {((inputs?: Confirm_PasswordInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Confirm_PasswordInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_confirm_password(inputs)
	return zh_confirm_password(inputs)
});
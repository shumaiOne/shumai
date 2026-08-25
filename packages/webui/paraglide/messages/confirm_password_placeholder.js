/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Confirm_Password_PlaceholderInputs */

const en_confirm_password_placeholder = /** @type {(inputs: Confirm_Password_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Confirm new password`)
};

const zh_confirm_password_placeholder = /** @type {(inputs: Confirm_Password_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`确认新密码`)
};

/**
* | output |
* | --- |
* | "Confirm new password" |
*
* @param {Confirm_Password_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const confirm_password_placeholder = /** @type {((inputs?: Confirm_Password_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Confirm_Password_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_confirm_password_placeholder(inputs)
	return zh_confirm_password_placeholder(inputs)
});
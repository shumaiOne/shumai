/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} New_PasswordInputs */

const en_new_password = /** @type {(inputs: New_PasswordInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`New Password`)
};

const zh_new_password = /** @type {(inputs: New_PasswordInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`新密码`)
};

/**
* | output |
* | --- |
* | "New Password" |
*
* @param {New_PasswordInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const new_password = /** @type {((inputs?: New_PasswordInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<New_PasswordInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_new_password(inputs)
	return zh_new_password(inputs)
});
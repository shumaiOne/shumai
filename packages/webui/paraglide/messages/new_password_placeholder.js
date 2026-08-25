/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} New_Password_PlaceholderInputs */

const en_new_password_placeholder = /** @type {(inputs: New_Password_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Enter new password`)
};

const zh_new_password_placeholder = /** @type {(inputs: New_Password_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`输入新密码`)
};

/**
* | output |
* | --- |
* | "Enter new password" |
*
* @param {New_Password_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const new_password_placeholder = /** @type {((inputs?: New_Password_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<New_Password_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_new_password_placeholder(inputs)
	return zh_new_password_placeholder(inputs)
});
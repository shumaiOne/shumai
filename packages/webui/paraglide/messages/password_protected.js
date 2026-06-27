/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Password_ProtectedInputs */

const en_password_protected = /** @type {(inputs: Password_ProtectedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Password Protected`)
};

const zh_password_protected = /** @type {(inputs: Password_ProtectedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`密码保护`)
};

/**
* | output |
* | --- |
* | "Password Protected" |
*
* @param {Password_ProtectedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const password_protected = /** @type {((inputs?: Password_ProtectedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Password_ProtectedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_password_protected(inputs)
	return zh_password_protected(inputs)
});
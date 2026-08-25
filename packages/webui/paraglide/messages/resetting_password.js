/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Resetting_PasswordInputs */

const en_resetting_password = /** @type {(inputs: Resetting_PasswordInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Resetting password...`)
};

const zh_resetting_password = /** @type {(inputs: Resetting_PasswordInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`正在重置密码...`)
};

/**
* | output |
* | --- |
* | "Resetting password..." |
*
* @param {Resetting_PasswordInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const resetting_password = /** @type {((inputs?: Resetting_PasswordInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Resetting_PasswordInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_resetting_password(inputs)
	return zh_resetting_password(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Password_Reset_SuccessInputs */

const en_password_reset_success = /** @type {(inputs: Password_Reset_SuccessInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Password reset successfully!`)
};

const zh_password_reset_success = /** @type {(inputs: Password_Reset_SuccessInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`密码重置成功！`)
};

/**
* | output |
* | --- |
* | "Password reset successfully!" |
*
* @param {Password_Reset_SuccessInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const password_reset_success = /** @type {((inputs?: Password_Reset_SuccessInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Password_Reset_SuccessInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_password_reset_success(inputs)
	return zh_password_reset_success(inputs)
});
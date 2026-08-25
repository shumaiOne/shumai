/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Password_Reset_Success_DescriptionInputs */

const en_password_reset_success_description = /** @type {(inputs: Password_Reset_Success_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`You will be redirected to the login page shortly.`)
};

const zh_password_reset_success_description = /** @type {(inputs: Password_Reset_Success_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`您将很快被重定向到登录页面。`)
};

/**
* | output |
* | --- |
* | "You will be redirected to the login page shortly." |
*
* @param {Password_Reset_Success_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const password_reset_success_description = /** @type {((inputs?: Password_Reset_Success_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Password_Reset_Success_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_password_reset_success_description(inputs)
	return zh_password_reset_success_description(inputs)
});
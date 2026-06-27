/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Email_Managed_By_AuthInputs */

const en_email_managed_by_auth = /** @type {(inputs: Email_Managed_By_AuthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Email address is managed by authentication provider.`)
};

const zh_email_managed_by_auth = /** @type {(inputs: Email_Managed_By_AuthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`邮箱地址由认证提供商管理。`)
};

/**
* | output |
* | --- |
* | "Email address is managed by authentication provider." |
*
* @param {Email_Managed_By_AuthInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const email_managed_by_auth = /** @type {((inputs?: Email_Managed_By_AuthInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Email_Managed_By_AuthInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_email_managed_by_auth(inputs)
	return zh_email_managed_by_auth(inputs)
});
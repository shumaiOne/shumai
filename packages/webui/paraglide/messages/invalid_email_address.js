/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Invalid_Email_AddressInputs */

const en_invalid_email_address = /** @type {(inputs: Invalid_Email_AddressInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Invalid email address`)
};

const zh_invalid_email_address = /** @type {(inputs: Invalid_Email_AddressInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`无效的邮箱地址`)
};

/**
* | output |
* | --- |
* | "Invalid email address" |
*
* @param {Invalid_Email_AddressInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const invalid_email_address = /** @type {((inputs?: Invalid_Email_AddressInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Invalid_Email_AddressInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_invalid_email_address(inputs)
	return zh_invalid_email_address(inputs)
});
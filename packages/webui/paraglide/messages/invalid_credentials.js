/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Invalid_CredentialsInputs */

const en_invalid_credentials = /** @type {(inputs: Invalid_CredentialsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Invalid credentials`)
};

const zh_invalid_credentials = /** @type {(inputs: Invalid_CredentialsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`凭证无效`)
};

/**
* | output |
* | --- |
* | "Invalid credentials" |
*
* @param {Invalid_CredentialsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const invalid_credentials = /** @type {((inputs?: Invalid_CredentialsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Invalid_CredentialsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_invalid_credentials(inputs)
	return zh_invalid_credentials(inputs)
});
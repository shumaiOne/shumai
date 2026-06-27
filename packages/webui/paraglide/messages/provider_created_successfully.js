/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Provider_Created_SuccessfullyInputs */

const en_provider_created_successfully = /** @type {(inputs: Provider_Created_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Provider created successfully`)
};

const zh_provider_created_successfully = /** @type {(inputs: Provider_Created_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`提供商创建成功`)
};

/**
* | output |
* | --- |
* | "Provider created successfully" |
*
* @param {Provider_Created_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const provider_created_successfully = /** @type {((inputs?: Provider_Created_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Provider_Created_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_provider_created_successfully(inputs)
	return zh_provider_created_successfully(inputs)
});
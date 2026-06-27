/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Provider_Updated_SuccessfullyInputs */

const en_provider_updated_successfully = /** @type {(inputs: Provider_Updated_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Provider updated successfully`)
};

const zh_provider_updated_successfully = /** @type {(inputs: Provider_Updated_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`提供商更新成功`)
};

/**
* | output |
* | --- |
* | "Provider updated successfully" |
*
* @param {Provider_Updated_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const provider_updated_successfully = /** @type {((inputs?: Provider_Updated_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Provider_Updated_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_provider_updated_successfully(inputs)
	return zh_provider_updated_successfully(inputs)
});
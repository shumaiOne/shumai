/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Provider_Deleted_SuccessfullyInputs */

const en_provider_deleted_successfully = /** @type {(inputs: Provider_Deleted_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Provider deleted successfully`)
};

const zh_provider_deleted_successfully = /** @type {(inputs: Provider_Deleted_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`提供商删除成功`)
};

/**
* | output |
* | --- |
* | "Provider deleted successfully" |
*
* @param {Provider_Deleted_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const provider_deleted_successfully = /** @type {((inputs?: Provider_Deleted_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Provider_Deleted_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_provider_deleted_successfully(inputs)
	return zh_provider_deleted_successfully(inputs)
});
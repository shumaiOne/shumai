/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Provider_NameInputs */

const en_provider_name = /** @type {(inputs: Provider_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Provider Name`)
};

const zh_provider_name = /** @type {(inputs: Provider_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`提供商名称`)
};

/**
* | output |
* | --- |
* | "Provider Name" |
*
* @param {Provider_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const provider_name = /** @type {((inputs?: Provider_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Provider_NameInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_provider_name(inputs)
	return zh_provider_name(inputs)
});
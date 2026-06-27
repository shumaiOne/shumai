/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_ProviderInputs */

const en_add_provider = /** @type {(inputs: Add_ProviderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Add Provider`)
};

const zh_add_provider = /** @type {(inputs: Add_ProviderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`添加提供商`)
};

/**
* | output |
* | --- |
* | "Add Provider" |
*
* @param {Add_ProviderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_provider = /** @type {((inputs?: Add_ProviderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_ProviderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_add_provider(inputs)
	return zh_add_provider(inputs)
});
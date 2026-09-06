/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Manage_ProviderInputs */

const en_manage_provider = /** @type {(inputs: Manage_ProviderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Manage`)
};

const zh_manage_provider = /** @type {(inputs: Manage_ProviderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`管理`)
};

/**
* | output |
* | --- |
* | "Manage" |
*
* @param {Manage_ProviderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const manage_provider = /** @type {((inputs?: Manage_ProviderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Manage_ProviderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_manage_provider(inputs)
	return zh_manage_provider(inputs)
});
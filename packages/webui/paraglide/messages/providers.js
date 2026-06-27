/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ProvidersInputs */

const en_providers = /** @type {(inputs: ProvidersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Providers`)
};

const zh_providers = /** @type {(inputs: ProvidersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`提供商`)
};

/**
* | output |
* | --- |
* | "Providers" |
*
* @param {ProvidersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const providers = /** @type {((inputs?: ProvidersInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ProvidersInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_providers(inputs)
	return zh_providers(inputs)
});
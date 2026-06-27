/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ProviderInputs */

const en_provider = /** @type {(inputs: ProviderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Provider`)
};

const zh_provider = /** @type {(inputs: ProviderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`提供商`)
};

/**
* | output |
* | --- |
* | "Provider" |
*
* @param {ProviderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const provider = /** @type {((inputs?: ProviderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ProviderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_provider(inputs)
	return zh_provider(inputs)
});
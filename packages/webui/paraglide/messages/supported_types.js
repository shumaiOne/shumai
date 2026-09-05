/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Supported_TypesInputs */

const en_supported_types = /** @type {(inputs: Supported_TypesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Supported`)
};

const zh_supported_types = /** @type {(inputs: Supported_TypesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`支持类型`)
};

/**
* | output |
* | --- |
* | "Supported" |
*
* @param {Supported_TypesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const supported_types = /** @type {((inputs?: Supported_TypesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Supported_TypesInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_supported_types(inputs)
	return zh_supported_types(inputs)
});
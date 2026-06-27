/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} TypeInputs */

const en_type = /** @type {(inputs: TypeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Type`)
};

const zh_type = /** @type {(inputs: TypeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`类型`)
};

/**
* | output |
* | --- |
* | "Type" |
*
* @param {TypeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const type = /** @type {((inputs?: TypeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<TypeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_type(inputs)
	return zh_type(inputs)
});
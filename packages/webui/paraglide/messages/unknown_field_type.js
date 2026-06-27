/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Unknown_Field_TypeInputs */

const en_unknown_field_type = /** @type {(inputs: Unknown_Field_TypeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Unknown Field Type`)
};

const zh_unknown_field_type = /** @type {(inputs: Unknown_Field_TypeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未知字段类型`)
};

/**
* | output |
* | --- |
* | "Unknown Field Type" |
*
* @param {Unknown_Field_TypeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const unknown_field_type = /** @type {((inputs?: Unknown_Field_TypeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Unknown_Field_TypeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_unknown_field_type(inputs)
	return zh_unknown_field_type(inputs)
});
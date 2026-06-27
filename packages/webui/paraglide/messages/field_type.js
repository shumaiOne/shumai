/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Field_TypeInputs */

const en_field_type = /** @type {(inputs: Field_TypeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Field Type`)
};

const zh_field_type = /** @type {(inputs: Field_TypeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`字段类型`)
};

/**
* | output |
* | --- |
* | "Field Type" |
*
* @param {Field_TypeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const field_type = /** @type {((inputs?: Field_TypeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Field_TypeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_field_type(inputs)
	return zh_field_type(inputs)
});
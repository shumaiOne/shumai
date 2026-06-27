/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Field_NameInputs */

const en_field_name = /** @type {(inputs: Field_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Field Name`)
};

const zh_field_name = /** @type {(inputs: Field_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`字段名称`)
};

/**
* | output |
* | --- |
* | "Field Name" |
*
* @param {Field_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const field_name = /** @type {((inputs?: Field_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Field_NameInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_field_name(inputs)
	return zh_field_name(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Field_Created_SuccessfullyInputs */

const en_field_created_successfully = /** @type {(inputs: Field_Created_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Field created successfully`)
};

const zh_field_created_successfully = /** @type {(inputs: Field_Created_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`字段创建成功`)
};

/**
* | output |
* | --- |
* | "Field created successfully" |
*
* @param {Field_Created_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const field_created_successfully = /** @type {((inputs?: Field_Created_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Field_Created_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_field_created_successfully(inputs)
	return zh_field_created_successfully(inputs)
});
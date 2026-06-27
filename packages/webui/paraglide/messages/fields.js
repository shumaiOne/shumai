/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} FieldsInputs */

const en_fields = /** @type {(inputs: FieldsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Fields`)
};

const zh_fields = /** @type {(inputs: FieldsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`字段`)
};

/**
* | output |
* | --- |
* | "Fields" |
*
* @param {FieldsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const fields = /** @type {((inputs?: FieldsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<FieldsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_fields(inputs)
	return zh_fields(inputs)
});
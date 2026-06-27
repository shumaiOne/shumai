/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Manage_FieldsInputs */

const en_manage_fields = /** @type {(inputs: Manage_FieldsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Manage Fields`)
};

const zh_manage_fields = /** @type {(inputs: Manage_FieldsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`管理字段`)
};

/**
* | output |
* | --- |
* | "Manage Fields" |
*
* @param {Manage_FieldsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const manage_fields = /** @type {((inputs?: Manage_FieldsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Manage_FieldsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_manage_fields(inputs)
	return zh_manage_fields(inputs)
});
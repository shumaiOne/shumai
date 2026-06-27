/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Confirm_Delete_FieldInputs */

const en_confirm_delete_field = /** @type {(inputs: Confirm_Delete_FieldInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Are you sure you want to delete this field?`)
};

const zh_confirm_delete_field = /** @type {(inputs: Confirm_Delete_FieldInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`确定要删除此字段吗？`)
};

/**
* | output |
* | --- |
* | "Are you sure you want to delete this field?" |
*
* @param {Confirm_Delete_FieldInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const confirm_delete_field = /** @type {((inputs?: Confirm_Delete_FieldInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Confirm_Delete_FieldInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_confirm_delete_field(inputs)
	return zh_confirm_delete_field(inputs)
});
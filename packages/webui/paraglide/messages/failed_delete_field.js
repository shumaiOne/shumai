/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Delete_FieldInputs */

const en_failed_delete_field = /** @type {(inputs: Failed_Delete_FieldInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to delete field`)
};

const zh_failed_delete_field = /** @type {(inputs: Failed_Delete_FieldInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`删除字段失败`)
};

/**
* | output |
* | --- |
* | "Failed to delete field" |
*
* @param {Failed_Delete_FieldInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_delete_field = /** @type {((inputs?: Failed_Delete_FieldInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Delete_FieldInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_delete_field(inputs)
	return zh_failed_delete_field(inputs)
});
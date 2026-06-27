/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Delete_FieldInputs */

const en_delete_field = /** @type {(inputs: Delete_FieldInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Delete field`)
};

const zh_delete_field = /** @type {(inputs: Delete_FieldInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`删除字段`)
};

/**
* | output |
* | --- |
* | "Delete field" |
*
* @param {Delete_FieldInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_field = /** @type {((inputs?: Delete_FieldInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_FieldInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_field(inputs)
	return zh_delete_field(inputs)
});
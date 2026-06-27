/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Type_Delete_To_ConfirmInputs */

const en_type_delete_to_confirm = /** @type {(inputs: Type_Delete_To_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Type **delete** to confirm:`)
};

const zh_type_delete_to_confirm = /** @type {(inputs: Type_Delete_To_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`输入 **delete** 以确认：`)
};

/**
* | output |
* | --- |
* | "Type **delete** to confirm:" |
*
* @param {Type_Delete_To_ConfirmInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const type_delete_to_confirm = /** @type {((inputs?: Type_Delete_To_ConfirmInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Type_Delete_To_ConfirmInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_type_delete_to_confirm(inputs)
	return zh_type_delete_to_confirm(inputs)
});
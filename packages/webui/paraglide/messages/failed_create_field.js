/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Create_FieldInputs */

const en_failed_create_field = /** @type {(inputs: Failed_Create_FieldInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to create field`)
};

const zh_failed_create_field = /** @type {(inputs: Failed_Create_FieldInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`创建字段失败`)
};

/**
* | output |
* | --- |
* | "Failed to create field" |
*
* @param {Failed_Create_FieldInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_create_field = /** @type {((inputs?: Failed_Create_FieldInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Create_FieldInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_create_field(inputs)
	return zh_failed_create_field(inputs)
});
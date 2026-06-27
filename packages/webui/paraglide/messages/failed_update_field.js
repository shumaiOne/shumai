/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Update_FieldInputs */

const en_failed_update_field = /** @type {(inputs: Failed_Update_FieldInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to update field`)
};

const zh_failed_update_field = /** @type {(inputs: Failed_Update_FieldInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`更新字段失败`)
};

/**
* | output |
* | --- |
* | "Failed to update field" |
*
* @param {Failed_Update_FieldInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_update_field = /** @type {((inputs?: Failed_Update_FieldInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Update_FieldInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_update_field(inputs)
	return zh_failed_update_field(inputs)
});
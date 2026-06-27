/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Update_Fields_OrderInputs */

const en_failed_update_fields_order = /** @type {(inputs: Failed_Update_Fields_OrderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to update fields order`)
};

const zh_failed_update_fields_order = /** @type {(inputs: Failed_Update_Fields_OrderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`更新字段排序失败`)
};

/**
* | output |
* | --- |
* | "Failed to update fields order" |
*
* @param {Failed_Update_Fields_OrderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_update_fields_order = /** @type {((inputs?: Failed_Update_Fields_OrderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Update_Fields_OrderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_update_fields_order(inputs)
	return zh_failed_update_fields_order(inputs)
});
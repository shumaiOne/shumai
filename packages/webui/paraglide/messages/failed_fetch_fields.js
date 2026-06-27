/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Fetch_FieldsInputs */

const en_failed_fetch_fields = /** @type {(inputs: Failed_Fetch_FieldsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to fetch fields`)
};

const zh_failed_fetch_fields = /** @type {(inputs: Failed_Fetch_FieldsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`获取字段列表失败`)
};

/**
* | output |
* | --- |
* | "Failed to fetch fields" |
*
* @param {Failed_Fetch_FieldsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_fetch_fields = /** @type {((inputs?: Failed_Fetch_FieldsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Fetch_FieldsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_fetch_fields(inputs)
	return zh_failed_fetch_fields(inputs)
});
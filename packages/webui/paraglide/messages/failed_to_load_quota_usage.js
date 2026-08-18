/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_Load_Quota_UsageInputs */

const en_failed_to_load_quota_usage = /** @type {(inputs: Failed_To_Load_Quota_UsageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to load quota usage`)
};

const zh_failed_to_load_quota_usage = /** @type {(inputs: Failed_To_Load_Quota_UsageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`加载配额使用量失败`)
};

/**
* | output |
* | --- |
* | "Failed to load quota usage" |
*
* @param {Failed_To_Load_Quota_UsageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_load_quota_usage = /** @type {((inputs?: Failed_To_Load_Quota_UsageInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_Load_Quota_UsageInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_to_load_quota_usage(inputs)
	return zh_failed_to_load_quota_usage(inputs)
});
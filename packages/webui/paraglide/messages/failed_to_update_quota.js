/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_Update_QuotaInputs */

const en_failed_to_update_quota = /** @type {(inputs: Failed_To_Update_QuotaInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to update quota rule`)
};

const zh_failed_to_update_quota = /** @type {(inputs: Failed_To_Update_QuotaInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`更新配额规则失败`)
};

/**
* | output |
* | --- |
* | "Failed to update quota rule" |
*
* @param {Failed_To_Update_QuotaInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_update_quota = /** @type {((inputs?: Failed_To_Update_QuotaInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_Update_QuotaInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_to_update_quota(inputs)
	return zh_failed_to_update_quota(inputs)
});
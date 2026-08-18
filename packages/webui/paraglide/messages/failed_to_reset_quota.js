/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_Reset_QuotaInputs */

const en_failed_to_reset_quota = /** @type {(inputs: Failed_To_Reset_QuotaInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to reset quota usage`)
};

const zh_failed_to_reset_quota = /** @type {(inputs: Failed_To_Reset_QuotaInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`重置配额使用量失败`)
};

/**
* | output |
* | --- |
* | "Failed to reset quota usage" |
*
* @param {Failed_To_Reset_QuotaInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_reset_quota = /** @type {((inputs?: Failed_To_Reset_QuotaInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_Reset_QuotaInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_to_reset_quota(inputs)
	return zh_failed_to_reset_quota(inputs)
});
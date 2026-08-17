/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Current_UsageInputs */

const en_quota_current_usage = /** @type {(inputs: Quota_Current_UsageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Current Usage`)
};

const zh_quota_current_usage = /** @type {(inputs: Quota_Current_UsageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`当前使用量`)
};

/**
* | output |
* | --- |
* | "Current Usage" |
*
* @param {Quota_Current_UsageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_current_usage = /** @type {((inputs?: Quota_Current_UsageInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Current_UsageInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_current_usage(inputs)
	return zh_quota_current_usage(inputs)
});
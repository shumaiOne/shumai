/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Reset_UsageInputs */

const en_quota_reset_usage = /** @type {(inputs: Quota_Reset_UsageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Reset Usage`)
};

const zh_quota_reset_usage = /** @type {(inputs: Quota_Reset_UsageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`重置使用量`)
};

/**
* | output |
* | --- |
* | "Reset Usage" |
*
* @param {Quota_Reset_UsageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_reset_usage = /** @type {((inputs?: Quota_Reset_UsageInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Reset_UsageInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_reset_usage(inputs)
	return zh_quota_reset_usage(inputs)
});
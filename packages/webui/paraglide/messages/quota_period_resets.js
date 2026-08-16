/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Period_ResetsInputs */

const en_quota_period_resets = /** @type {(inputs: Quota_Period_ResetsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Resets in`)
};

const zh_quota_period_resets = /** @type {(inputs: Quota_Period_ResetsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`重置于`)
};

/**
* | output |
* | --- |
* | "Resets in" |
*
* @param {Quota_Period_ResetsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_period_resets = /** @type {((inputs?: Quota_Period_ResetsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Period_ResetsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_period_resets(inputs)
	return zh_quota_period_resets(inputs)
});
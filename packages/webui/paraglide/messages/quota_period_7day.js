/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Period_7dayInputs */

const en_quota_period_7day = /** @type {(inputs: Quota_Period_7dayInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`7 Days`)
};

const zh_quota_period_7day = /** @type {(inputs: Quota_Period_7dayInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`7 天`)
};

/**
* | output |
* | --- |
* | "7 Days" |
*
* @param {Quota_Period_7dayInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_period_7day = /** @type {((inputs?: Quota_Period_7dayInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Period_7dayInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_period_7day(inputs)
	return zh_quota_period_7day(inputs)
});
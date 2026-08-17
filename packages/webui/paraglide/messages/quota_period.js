/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_PeriodInputs */

const en_quota_period = /** @type {(inputs: Quota_PeriodInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Period Window`)
};

const zh_quota_period = /** @type {(inputs: Quota_PeriodInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`周期窗口`)
};

/**
* | output |
* | --- |
* | "Period Window" |
*
* @param {Quota_PeriodInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_period = /** @type {((inputs?: Quota_PeriodInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_PeriodInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_period(inputs)
	return zh_quota_period(inputs)
});
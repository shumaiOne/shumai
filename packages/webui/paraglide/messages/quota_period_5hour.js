/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Period_5hourInputs */

const en_quota_period_5hour = /** @type {(inputs: Quota_Period_5hourInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`5 Hours`)
};

const zh_quota_period_5hour = /** @type {(inputs: Quota_Period_5hourInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`5 小时`)
};

/**
* | output |
* | --- |
* | "5 Hours" |
*
* @param {Quota_Period_5hourInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_period_5hour = /** @type {((inputs?: Quota_Period_5hourInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Period_5hourInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_period_5hour(inputs)
	return zh_quota_period_5hour(inputs)
});
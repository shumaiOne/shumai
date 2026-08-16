/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Period_1hourInputs */

const en_quota_period_1hour = /** @type {(inputs: Quota_Period_1hourInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`1 Hour`)
};

const zh_quota_period_1hour = /** @type {(inputs: Quota_Period_1hourInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`1 小时`)
};

/**
* | output |
* | --- |
* | "1 Hour" |
*
* @param {Quota_Period_1hourInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_period_1hour = /** @type {((inputs?: Quota_Period_1hourInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Period_1hourInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_period_1hour(inputs)
	return zh_quota_period_1hour(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Period_1dayInputs */

const en_quota_period_1day = /** @type {(inputs: Quota_Period_1dayInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`1 Day`)
};

const zh_quota_period_1day = /** @type {(inputs: Quota_Period_1dayInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`1 天`)
};

/**
* | output |
* | --- |
* | "1 Day" |
*
* @param {Quota_Period_1dayInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_period_1day = /** @type {((inputs?: Quota_Period_1dayInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Period_1dayInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_period_1day(inputs)
	return zh_quota_period_1day(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Usage_Records_DescriptionInputs */

const en_quota_usage_records_description = /** @type {(inputs: Quota_Usage_Records_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Real-time usage breakdown for this quota rule.`)
};

const zh_quota_usage_records_description = /** @type {(inputs: Quota_Usage_Records_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`该配额规则的实时使用明细与生效状态。`)
};

/**
* | output |
* | --- |
* | "Real-time usage breakdown for this quota rule." |
*
* @param {Quota_Usage_Records_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_usage_records_description = /** @type {((inputs?: Quota_Usage_Records_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Usage_Records_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_usage_records_description(inputs)
	return zh_quota_usage_records_description(inputs)
});
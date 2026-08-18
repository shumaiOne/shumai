/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_No_Usage_RecordsInputs */

const en_quota_no_usage_records = /** @type {(inputs: Quota_No_Usage_RecordsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No usage records found`)
};

const zh_quota_no_usage_records = /** @type {(inputs: Quota_No_Usage_RecordsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`暂无使用记录`)
};

/**
* | output |
* | --- |
* | "No usage records found" |
*
* @param {Quota_No_Usage_RecordsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_no_usage_records = /** @type {((inputs?: Quota_No_Usage_RecordsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_No_Usage_RecordsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_no_usage_records(inputs)
	return zh_quota_no_usage_records(inputs)
});
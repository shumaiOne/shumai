/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Usage_RecordsInputs */

const en_quota_usage_records = /** @type {(inputs: Quota_Usage_RecordsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Usage Records`)
};

const zh_quota_usage_records = /** @type {(inputs: Quota_Usage_RecordsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`使用记录`)
};

/**
* | output |
* | --- |
* | "Usage Records" |
*
* @param {Quota_Usage_RecordsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_usage_records = /** @type {((inputs?: Quota_Usage_RecordsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Usage_RecordsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_usage_records(inputs)
	return zh_quota_usage_records(inputs)
});
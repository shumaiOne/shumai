/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Dashboard_DescriptionInputs */

const en_quota_dashboard_description = /** @type {(inputs: Quota_Dashboard_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Monitor live quota usage and reset individual usage windows.`)
};

const zh_quota_dashboard_description = /** @type {(inputs: Quota_Dashboard_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`在仪表盘中监控实时配额使用情况，并重置单个使用窗口。`)
};

/**
* | output |
* | --- |
* | "Monitor live quota usage and reset individual usage windows." |
*
* @param {Quota_Dashboard_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_dashboard_description = /** @type {((inputs?: Quota_Dashboard_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Dashboard_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_dashboard_description(inputs)
	return zh_quota_dashboard_description(inputs)
});
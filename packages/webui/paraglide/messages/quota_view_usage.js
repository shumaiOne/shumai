/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_View_UsageInputs */

const en_quota_view_usage = /** @type {(inputs: Quota_View_UsageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`View Usage`)
};

const zh_quota_view_usage = /** @type {(inputs: Quota_View_UsageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`查看使用量`)
};

/**
* | output |
* | --- |
* | "View Usage" |
*
* @param {Quota_View_UsageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_view_usage = /** @type {((inputs?: Quota_View_UsageInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_View_UsageInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_view_usage(inputs)
	return zh_quota_view_usage(inputs)
});
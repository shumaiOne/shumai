/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_LimitInputs */

const en_quota_limit = /** @type {(inputs: Quota_LimitInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Limit`)
};

const zh_quota_limit = /** @type {(inputs: Quota_LimitInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`上限`)
};

/**
* | output |
* | --- |
* | "Limit" |
*
* @param {Quota_LimitInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_limit = /** @type {((inputs?: Quota_LimitInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_LimitInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_limit(inputs)
	return zh_quota_limit(inputs)
});
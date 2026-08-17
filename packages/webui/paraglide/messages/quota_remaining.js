/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_RemainingInputs */

const en_quota_remaining = /** @type {(inputs: Quota_RemainingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Remaining`)
};

const zh_quota_remaining = /** @type {(inputs: Quota_RemainingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`剩余额度`)
};

/**
* | output |
* | --- |
* | "Remaining" |
*
* @param {Quota_RemainingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_remaining = /** @type {((inputs?: Quota_RemainingInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_RemainingInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_remaining(inputs)
	return zh_quota_remaining(inputs)
});
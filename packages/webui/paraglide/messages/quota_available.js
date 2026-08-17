/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_AvailableInputs */

const en_quota_available = /** @type {(inputs: Quota_AvailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Quota available`)
};

const zh_quota_available = /** @type {(inputs: Quota_AvailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`配额可用`)
};

/**
* | output |
* | --- |
* | "Quota available" |
*
* @param {Quota_AvailableInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_available = /** @type {((inputs?: Quota_AvailableInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_AvailableInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_available(inputs)
	return zh_quota_available(inputs)
});
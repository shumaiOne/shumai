/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_ActiveInputs */

const en_quota_active = /** @type {(inputs: Quota_ActiveInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Active`)
};

const zh_quota_active = /** @type {(inputs: Quota_ActiveInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`使用中`)
};

/**
* | output |
* | --- |
* | "Active" |
*
* @param {Quota_ActiveInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_active = /** @type {((inputs?: Quota_ActiveInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_ActiveInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_active(inputs)
	return zh_quota_active(inputs)
});
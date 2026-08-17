/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ time: NonNullable<unknown> }} Quota_Refreshes_InInputs */

const en_quota_refreshes_in = /** @type {(inputs: Quota_Refreshes_InInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Refreshes in ${i?.time}`)
};

const zh_quota_refreshes_in = /** @type {(inputs: Quota_Refreshes_InInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.time} 后重置`)
};

/**
* | output |
* | --- |
* | "Refreshes in {time}" |
*
* @param {Quota_Refreshes_InInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_refreshes_in = /** @type {((inputs: Quota_Refreshes_InInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Refreshes_InInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_refreshes_in(inputs)
	return zh_quota_refreshes_in(inputs)
});
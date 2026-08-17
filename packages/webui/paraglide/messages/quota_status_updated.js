/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Status_UpdatedInputs */

const en_quota_status_updated = /** @type {(inputs: Quota_Status_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Quota status updated`)
};

const zh_quota_status_updated = /** @type {(inputs: Quota_Status_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`配额状态已更新`)
};

/**
* | output |
* | --- |
* | "Quota status updated" |
*
* @param {Quota_Status_UpdatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_status_updated = /** @type {((inputs?: Quota_Status_UpdatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Status_UpdatedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_status_updated(inputs)
	return zh_quota_status_updated(inputs)
});
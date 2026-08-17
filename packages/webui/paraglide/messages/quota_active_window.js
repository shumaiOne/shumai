/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Active_WindowInputs */

const en_quota_active_window = /** @type {(inputs: Quota_Active_WindowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Active Window`)
};

const zh_quota_active_window = /** @type {(inputs: Quota_Active_WindowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`生效周期`)
};

/**
* | output |
* | --- |
* | "Active Window" |
*
* @param {Quota_Active_WindowInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_active_window = /** @type {((inputs?: Quota_Active_WindowInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Active_WindowInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_active_window(inputs)
	return zh_quota_active_window(inputs)
});
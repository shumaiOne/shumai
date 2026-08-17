/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_EnabledInputs */

const en_quota_enabled = /** @type {(inputs: Quota_EnabledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Enabled`)
};

const zh_quota_enabled = /** @type {(inputs: Quota_EnabledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已启用`)
};

/**
* | output |
* | --- |
* | "Enabled" |
*
* @param {Quota_EnabledInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_enabled = /** @type {((inputs?: Quota_EnabledInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_EnabledInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_enabled(inputs)
	return zh_quota_enabled(inputs)
});
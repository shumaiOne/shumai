/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Limit_PlaceholderInputs */

const en_quota_limit_placeholder = /** @type {(inputs: Quota_Limit_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`e.g. 100000`)
};

const zh_quota_limit_placeholder = /** @type {(inputs: Quota_Limit_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`例如 100000`)
};

/**
* | output |
* | --- |
* | "e.g. 100000" |
*
* @param {Quota_Limit_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_limit_placeholder = /** @type {((inputs?: Quota_Limit_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Limit_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_limit_placeholder(inputs)
	return zh_quota_limit_placeholder(inputs)
});
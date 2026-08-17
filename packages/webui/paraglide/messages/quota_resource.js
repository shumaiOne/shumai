/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_ResourceInputs */

const en_quota_resource = /** @type {(inputs: Quota_ResourceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Resource`)
};

const zh_quota_resource = /** @type {(inputs: Quota_ResourceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`资源类型`)
};

/**
* | output |
* | --- |
* | "Resource" |
*
* @param {Quota_ResourceInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_resource = /** @type {((inputs?: Quota_ResourceInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_ResourceInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_resource(inputs)
	return zh_quota_resource(inputs)
});
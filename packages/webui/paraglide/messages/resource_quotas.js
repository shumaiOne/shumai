/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Resource_QuotasInputs */

const en_resource_quotas = /** @type {(inputs: Resource_QuotasInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Resource Quotas`)
};

const zh_resource_quotas = /** @type {(inputs: Resource_QuotasInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`资源配额`)
};

/**
* | output |
* | --- |
* | "Resource Quotas" |
*
* @param {Resource_QuotasInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const resource_quotas = /** @type {((inputs?: Resource_QuotasInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Resource_QuotasInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_resource_quotas(inputs)
	return zh_resource_quotas(inputs)
});
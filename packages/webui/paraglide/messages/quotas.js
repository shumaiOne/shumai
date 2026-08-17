/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} QuotasInputs */

const en_quotas = /** @type {(inputs: QuotasInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Quotas`)
};

const zh_quotas = /** @type {(inputs: QuotasInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`配额`)
};

/**
* | output |
* | --- |
* | "Quotas" |
*
* @param {QuotasInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quotas = /** @type {((inputs?: QuotasInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<QuotasInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quotas(inputs)
	return zh_quotas(inputs)
});
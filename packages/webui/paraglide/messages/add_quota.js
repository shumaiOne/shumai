/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_QuotaInputs */

const en_add_quota = /** @type {(inputs: Add_QuotaInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Add Quota`)
};

const zh_add_quota = /** @type {(inputs: Add_QuotaInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`添加配额`)
};

/**
* | output |
* | --- |
* | "Add Quota" |
*
* @param {Add_QuotaInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_quota = /** @type {((inputs?: Add_QuotaInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_QuotaInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_add_quota(inputs)
	return zh_add_quota(inputs)
});
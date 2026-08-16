/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Delete_QuotaInputs */

const en_delete_quota = /** @type {(inputs: Delete_QuotaInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Delete Quota`)
};

const zh_delete_quota = /** @type {(inputs: Delete_QuotaInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`删除配额`)
};

/**
* | output |
* | --- |
* | "Delete Quota" |
*
* @param {Delete_QuotaInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_quota = /** @type {((inputs?: Delete_QuotaInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_QuotaInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_quota(inputs)
	return zh_delete_quota(inputs)
});
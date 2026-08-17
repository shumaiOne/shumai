/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Created_SuccessfullyInputs */

const en_quota_created_successfully = /** @type {(inputs: Quota_Created_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Quota rule created successfully`)
};

const zh_quota_created_successfully = /** @type {(inputs: Quota_Created_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`配额规则创建成功`)
};

/**
* | output |
* | --- |
* | "Quota rule created successfully" |
*
* @param {Quota_Created_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_created_successfully = /** @type {((inputs?: Quota_Created_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Created_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_created_successfully(inputs)
	return zh_quota_created_successfully(inputs)
});
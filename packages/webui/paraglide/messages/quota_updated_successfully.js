/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Updated_SuccessfullyInputs */

const en_quota_updated_successfully = /** @type {(inputs: Quota_Updated_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Quota rule updated successfully`)
};

const zh_quota_updated_successfully = /** @type {(inputs: Quota_Updated_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`配额规则更新成功`)
};

/**
* | output |
* | --- |
* | "Quota rule updated successfully" |
*
* @param {Quota_Updated_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_updated_successfully = /** @type {((inputs?: Quota_Updated_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Updated_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_updated_successfully(inputs)
	return zh_quota_updated_successfully(inputs)
});
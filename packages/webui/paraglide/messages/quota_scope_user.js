/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Scope_UserInputs */

const en_quota_scope_user = /** @type {(inputs: Quota_Scope_UserInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Specific User`)
};

const zh_quota_scope_user = /** @type {(inputs: Quota_Scope_UserInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`指定用户`)
};

/**
* | output |
* | --- |
* | "Specific User" |
*
* @param {Quota_Scope_UserInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_scope_user = /** @type {((inputs?: Quota_Scope_UserInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Scope_UserInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_scope_user(inputs)
	return zh_quota_scope_user(inputs)
});
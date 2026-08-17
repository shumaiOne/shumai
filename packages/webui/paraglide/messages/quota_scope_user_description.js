/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Scope_User_DescriptionInputs */

const en_quota_scope_user_description = /** @type {(inputs: Quota_Scope_User_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Applies exclusively to the selected user`)
};

const zh_quota_scope_user_description = /** @type {(inputs: Quota_Scope_User_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`仅对选定的用户生效`)
};

/**
* | output |
* | --- |
* | "Applies exclusively to the selected user" |
*
* @param {Quota_Scope_User_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_scope_user_description = /** @type {((inputs?: Quota_Scope_User_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Scope_User_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_scope_user_description(inputs)
	return zh_quota_scope_user_description(inputs)
});
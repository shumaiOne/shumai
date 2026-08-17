/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Scope_Role_DescriptionInputs */

const en_quota_scope_role_description = /** @type {(inputs: Quota_Scope_Role_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Applies to members with the specified role`)
};

const zh_quota_scope_role_description = /** @type {(inputs: Quota_Scope_Role_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`对具有指定角色的成员生效`)
};

/**
* | output |
* | --- |
* | "Applies to members with the specified role" |
*
* @param {Quota_Scope_Role_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_scope_role_description = /** @type {((inputs?: Quota_Scope_Role_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Scope_Role_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_scope_role_description(inputs)
	return zh_quota_scope_role_description(inputs)
});
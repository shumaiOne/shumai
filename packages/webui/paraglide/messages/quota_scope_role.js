/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Scope_RoleInputs */

const en_quota_scope_role = /** @type {(inputs: Quota_Scope_RoleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Role-based`)
};

const zh_quota_scope_role = /** @type {(inputs: Quota_Scope_RoleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`按角色`)
};

/**
* | output |
* | --- |
* | "Role-based" |
*
* @param {Quota_Scope_RoleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_scope_role = /** @type {((inputs?: Quota_Scope_RoleInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Scope_RoleInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_scope_role(inputs)
	return zh_quota_scope_role(inputs)
});
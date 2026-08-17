/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Scope_Mode_Each_MemberInputs */

const en_quota_scope_mode_each_member = /** @type {(inputs: Quota_Scope_Mode_Each_MemberInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Each Member`)
};

const zh_quota_scope_mode_each_member = /** @type {(inputs: Quota_Scope_Mode_Each_MemberInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`每个成员`)
};

/**
* | output |
* | --- |
* | "Each Member" |
*
* @param {Quota_Scope_Mode_Each_MemberInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_scope_mode_each_member = /** @type {((inputs?: Quota_Scope_Mode_Each_MemberInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Scope_Mode_Each_MemberInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_scope_mode_each_member(inputs)
	return zh_quota_scope_mode_each_member(inputs)
});
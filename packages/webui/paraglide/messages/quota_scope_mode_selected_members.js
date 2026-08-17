/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Scope_Mode_Selected_MembersInputs */

const en_quota_scope_mode_selected_members = /** @type {(inputs: Quota_Scope_Mode_Selected_MembersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Selected Members`)
};

const zh_quota_scope_mode_selected_members = /** @type {(inputs: Quota_Scope_Mode_Selected_MembersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`指定成员`)
};

/**
* | output |
* | --- |
* | "Selected Members" |
*
* @param {Quota_Scope_Mode_Selected_MembersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_scope_mode_selected_members = /** @type {((inputs?: Quota_Scope_Mode_Selected_MembersInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Scope_Mode_Selected_MembersInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_scope_mode_selected_members(inputs)
	return zh_quota_scope_mode_selected_members(inputs)
});
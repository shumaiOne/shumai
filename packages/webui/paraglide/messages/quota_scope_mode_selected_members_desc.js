/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Scope_Mode_Selected_Members_DescInputs */

const en_quota_scope_mode_selected_members_desc = /** @type {(inputs: Quota_Scope_Mode_Selected_Members_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Individual limit for selected users`)
};

const zh_quota_scope_mode_selected_members_desc = /** @type {(inputs: Quota_Scope_Mode_Selected_Members_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`为选定的成员分别设定独立的配额上限`)
};

/**
* | output |
* | --- |
* | "Individual limit for selected users" |
*
* @param {Quota_Scope_Mode_Selected_Members_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_scope_mode_selected_members_desc = /** @type {((inputs?: Quota_Scope_Mode_Selected_Members_DescInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Scope_Mode_Selected_Members_DescInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_scope_mode_selected_members_desc(inputs)
	return zh_quota_scope_mode_selected_members_desc(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Edit_Quota_RuleInputs */

const en_edit_quota_rule = /** @type {(inputs: Edit_Quota_RuleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Edit Quota Rule`)
};

const zh_edit_quota_rule = /** @type {(inputs: Edit_Quota_RuleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`编辑配额规则`)
};

/**
* | output |
* | --- |
* | "Edit Quota Rule" |
*
* @param {Edit_Quota_RuleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const edit_quota_rule = /** @type {((inputs?: Edit_Quota_RuleInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Edit_Quota_RuleInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_edit_quota_rule(inputs)
	return zh_edit_quota_rule(inputs)
});
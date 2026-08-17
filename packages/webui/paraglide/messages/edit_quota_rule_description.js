/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Edit_Quota_Rule_DescriptionInputs */

const en_edit_quota_rule_description = /** @type {(inputs: Edit_Quota_Rule_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Configure resource limits, target scopes, and evaluation periods.`)
};

const zh_edit_quota_rule_description = /** @type {(inputs: Edit_Quota_Rule_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`配置资源上限、目标范围以及评估周期。`)
};

/**
* | output |
* | --- |
* | "Configure resource limits, target scopes, and evaluation periods." |
*
* @param {Edit_Quota_Rule_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const edit_quota_rule_description = /** @type {((inputs?: Edit_Quota_Rule_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Edit_Quota_Rule_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_edit_quota_rule_description(inputs)
	return zh_edit_quota_rule_description(inputs)
});
/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Expand_RuleInputs */

const en_quota_expand_rule = /** @type {(inputs: Quota_Expand_RuleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Expand quota rule`)
};

const zh_quota_expand_rule = /** @type {(inputs: Quota_Expand_RuleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`展开配额规则`)
};

/**
* | output |
* | --- |
* | "Expand quota rule" |
*
* @param {Quota_Expand_RuleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_expand_rule = /** @type {((inputs?: Quota_Expand_RuleInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Expand_RuleInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_expand_rule(inputs)
	return zh_quota_expand_rule(inputs)
});
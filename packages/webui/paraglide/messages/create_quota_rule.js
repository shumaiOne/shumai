/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Create_Quota_RuleInputs */

const en_create_quota_rule = /** @type {(inputs: Create_Quota_RuleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Create Quota Rule`)
};

const zh_create_quota_rule = /** @type {(inputs: Create_Quota_RuleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`创建配额规则`)
};

/**
* | output |
* | --- |
* | "Create Quota Rule" |
*
* @param {Create_Quota_RuleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const create_quota_rule = /** @type {((inputs?: Create_Quota_RuleInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Create_Quota_RuleInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_create_quota_rule(inputs)
	return zh_create_quota_rule(inputs)
});
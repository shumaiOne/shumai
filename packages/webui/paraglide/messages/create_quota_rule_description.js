/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Create_Quota_Rule_DescriptionInputs */

const en_create_quota_rule_description = /** @type {(inputs: Create_Quota_Rule_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Set up a new resource quota to prevent unexpected usage.`)
};

const zh_create_quota_rule_description = /** @type {(inputs: Create_Quota_Rule_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`设置新的资源配额以防止意外的超量使用。`)
};

/**
* | output |
* | --- |
* | "Set up a new resource quota to prevent unexpected usage." |
*
* @param {Create_Quota_Rule_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const create_quota_rule_description = /** @type {((inputs?: Create_Quota_Rule_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Create_Quota_Rule_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_create_quota_rule_description(inputs)
	return zh_create_quota_rule_description(inputs)
});
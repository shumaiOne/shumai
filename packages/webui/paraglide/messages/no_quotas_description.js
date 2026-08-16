/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Quotas_DescriptionInputs */

const en_no_quotas_description = /** @type {(inputs: No_Quotas_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Set limits on AI tokens, costs, skill executions, and network requests to manage team usage.`)
};

const zh_no_quotas_description = /** @type {(inputs: No_Quotas_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`为 AI Token、费用、Skill 执行和网络请求设置限制，以便管理团队的使用情况。`)
};

/**
* | output |
* | --- |
* | "Set limits on AI tokens, costs, skill executions, and network requests to manage team usage." |
*
* @param {No_Quotas_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_quotas_description = /** @type {((inputs?: No_Quotas_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Quotas_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_quotas_description(inputs)
	return zh_no_quotas_description(inputs)
});
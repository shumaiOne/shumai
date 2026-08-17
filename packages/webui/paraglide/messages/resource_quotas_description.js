/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Resource_Quotas_DescriptionInputs */

const en_resource_quotas_description = /** @type {(inputs: Resource_Quotas_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Manage and limit resource usage across team members, roles, and AI operations.`)
};

const zh_resource_quotas_description = /** @type {(inputs: Resource_Quotas_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`管理并限制团队成员、角色以及 AI 操作的资源使用。`)
};

/**
* | output |
* | --- |
* | "Manage and limit resource usage across team members, roles, and AI operations." |
*
* @param {Resource_Quotas_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const resource_quotas_description = /** @type {((inputs?: Resource_Quotas_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Resource_Quotas_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_resource_quotas_description(inputs)
	return zh_resource_quotas_description(inputs)
});
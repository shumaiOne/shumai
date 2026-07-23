/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Ai_Usage_DescriptionInputs */

const en_ai_usage_description = /** @type {(inputs: Ai_Usage_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Monitor AI token consumption and estimated costs for your team and members.`)
};

const zh_ai_usage_description = /** @type {(inputs: Ai_Usage_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`查看并监控团队及成员的 AI Token 消耗与预估费用。`)
};

/**
* | output |
* | --- |
* | "Monitor AI token consumption and estimated costs for your team and members." |
*
* @param {Ai_Usage_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const ai_usage_description = /** @type {((inputs?: Ai_Usage_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Ai_Usage_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_ai_usage_description(inputs)
	return zh_ai_usage_description(inputs)
});
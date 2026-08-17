/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Resource_Agent_Total_TokensInputs */

const en_quota_resource_agent_total_tokens = /** @type {(inputs: Quota_Resource_Agent_Total_TokensInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AI Tokens`)
};

const zh_quota_resource_agent_total_tokens = /** @type {(inputs: Quota_Resource_Agent_Total_TokensInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AI Token 总量`)
};

/**
* | output |
* | --- |
* | "AI Tokens" |
*
* @param {Quota_Resource_Agent_Total_TokensInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_resource_agent_total_tokens = /** @type {((inputs?: Quota_Resource_Agent_Total_TokensInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Resource_Agent_Total_TokensInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_resource_agent_total_tokens(inputs)
	return zh_quota_resource_agent_total_tokens(inputs)
});
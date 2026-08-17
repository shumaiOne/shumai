/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Resource_Agent_CostInputs */

const en_quota_resource_agent_cost = /** @type {(inputs: Quota_Resource_Agent_CostInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AI Cost ($)`)
};

const zh_quota_resource_agent_cost = /** @type {(inputs: Quota_Resource_Agent_CostInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AI 费用 ($)`)
};

/**
* | output |
* | --- |
* | "AI Cost ($)" |
*
* @param {Quota_Resource_Agent_CostInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_resource_agent_cost = /** @type {((inputs?: Quota_Resource_Agent_CostInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Resource_Agent_CostInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_resource_agent_cost(inputs)
	return zh_quota_resource_agent_cost(inputs)
});
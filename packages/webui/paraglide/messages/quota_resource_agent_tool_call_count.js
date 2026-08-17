/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Resource_Agent_Tool_Call_CountInputs */

const en_quota_resource_agent_tool_call_count = /** @type {(inputs: Quota_Resource_Agent_Tool_Call_CountInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Agent Tool Calls`)
};

const zh_quota_resource_agent_tool_call_count = /** @type {(inputs: Quota_Resource_Agent_Tool_Call_CountInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`智能体工具调用次数`)
};

/**
* | output |
* | --- |
* | "Agent Tool Calls" |
*
* @param {Quota_Resource_Agent_Tool_Call_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_resource_agent_tool_call_count = /** @type {((inputs?: Quota_Resource_Agent_Tool_Call_CountInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Resource_Agent_Tool_Call_CountInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_resource_agent_tool_call_count(inputs)
	return zh_quota_resource_agent_tool_call_count(inputs)
});
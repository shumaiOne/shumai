/**
* | output |
* | --- |
* | "AI Cost ($)" |
*
* @param {Quota_Resource_Agent_CostInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_resource_agent_cost: ((inputs?: Quota_Resource_Agent_CostInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Resource_Agent_CostInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Resource_Agent_CostInputs = {};

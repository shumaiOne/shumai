/**
* | output |
* | --- |
* | "AI Tokens" |
*
* @param {Quota_Resource_Agent_Total_TokensInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_resource_agent_total_tokens: ((inputs?: Quota_Resource_Agent_Total_TokensInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Resource_Agent_Total_TokensInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Resource_Agent_Total_TokensInputs = {};

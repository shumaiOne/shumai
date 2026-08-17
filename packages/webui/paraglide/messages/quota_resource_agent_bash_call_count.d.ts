/**
* | output |
* | --- |
* | "Agent Bash Calls" |
*
* @param {Quota_Resource_Agent_Bash_Call_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_resource_agent_bash_call_count: ((inputs?: Quota_Resource_Agent_Bash_Call_CountInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Resource_Agent_Bash_Call_CountInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Resource_Agent_Bash_Call_CountInputs = {};

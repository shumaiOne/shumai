/**
* | output |
* | --- |
* | "Configure which tools the agent is permitted to use." |
*
* @param {Agent_Tools_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tools_description: ((inputs?: Agent_Tools_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Tools_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Tools_DescriptionInputs = {};

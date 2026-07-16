/**
* | output |
* | --- |
* | "Allows the agent to upload and stack a new version of an existing file in Shumai." |
*
* @param {Agent_Tool_Create_Version_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_create_version_desc: ((inputs?: Agent_Tool_Create_Version_DescInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Tool_Create_Version_DescInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Tool_Create_Version_DescInputs = {};

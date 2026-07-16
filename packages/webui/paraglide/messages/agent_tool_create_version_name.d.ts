/**
* | output |
* | --- |
* | "Create Version" |
*
* @param {Agent_Tool_Create_Version_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_create_version_name: ((inputs?: Agent_Tool_Create_Version_NameInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Tool_Create_Version_NameInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Tool_Create_Version_NameInputs = {};

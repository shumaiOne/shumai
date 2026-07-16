/**
* | output |
* | --- |
* | "Allows the agent to list folders and browse files in Shumai." |
*
* @param {Agent_Tool_List_Assets_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_list_assets_desc: ((inputs?: Agent_Tool_List_Assets_DescInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Tool_List_Assets_DescInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Tool_List_Assets_DescInputs = {};

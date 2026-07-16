/**
* | output |
* | --- |
* | "Browse Shumai" |
*
* @param {Agent_Tool_List_Assets_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_list_assets_name: ((inputs?: Agent_Tool_List_Assets_NameInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Tool_List_Assets_NameInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Tool_List_Assets_NameInputs = {};

/**
* | output |
* | --- |
* | "Allows the agent to create new folders in Shumai." |
*
* @param {Agent_Tool_Create_Folder_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_create_folder_desc: ((inputs?: Agent_Tool_Create_Folder_DescInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Tool_Create_Folder_DescInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Tool_Create_Folder_DescInputs = {};

/**
* | output |
* | --- |
* | "Allows the agent to create and upload new files to Shumai." |
*
* @param {Agent_Tool_Create_File_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_create_file_desc: ((inputs?: Agent_Tool_Create_File_DescInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Tool_Create_File_DescInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Tool_Create_File_DescInputs = {};

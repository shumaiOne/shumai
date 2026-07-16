/**
* | output |
* | --- |
* | "Allows the agent to load and read skill definitions to perform specialized actions." |
*
* @param {Agent_Tool_Read_Skill_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_read_skill_desc: ((inputs?: Agent_Tool_Read_Skill_DescInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Tool_Read_Skill_DescInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Tool_Read_Skill_DescInputs = {};

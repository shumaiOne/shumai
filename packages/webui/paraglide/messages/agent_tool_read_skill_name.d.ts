/**
* | output |
* | --- |
* | "Read Skills" |
*
* @param {Agent_Tool_Read_Skill_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_read_skill_name: ((inputs?: Agent_Tool_Read_Skill_NameInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Tool_Read_Skill_NameInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Tool_Read_Skill_NameInputs = {};

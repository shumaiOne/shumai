/**
* | output |
* | --- |
* | "Allows the agent to run terminal/shell commands in a highly isolated environment." |
*
* @param {Agent_Tool_Bash_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_bash_desc: ((inputs?: Agent_Tool_Bash_DescInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Tool_Bash_DescInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Tool_Bash_DescInputs = {};

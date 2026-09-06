/**
* | output |
* | --- |
* | "Generate Video" |
*
* @param {Agent_Tool_Generate_Video_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_generate_video_name: ((inputs?: Agent_Tool_Generate_Video_NameInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Tool_Generate_Video_NameInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Tool_Generate_Video_NameInputs = {};

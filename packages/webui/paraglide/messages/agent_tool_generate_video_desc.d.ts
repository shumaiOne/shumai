/**
* | output |
* | --- |
* | "Allows the agent to generate videos from text, images, or frame sequences using configured AI video models." |
*
* @param {Agent_Tool_Generate_Video_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_generate_video_desc: ((inputs?: Agent_Tool_Generate_Video_DescInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Tool_Generate_Video_DescInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Tool_Generate_Video_DescInputs = {};

/**
* | output |
* | --- |
* | "Allows the agent to view and analyze the visual contents of an image file." |
*
* @param {Agent_Tool_Analyze_Image_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_analyze_image_desc: ((inputs?: Agent_Tool_Analyze_Image_DescInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Tool_Analyze_Image_DescInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Tool_Analyze_Image_DescInputs = {};

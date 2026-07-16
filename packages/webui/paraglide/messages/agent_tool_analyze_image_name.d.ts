/**
* | output |
* | --- |
* | "Analyze Image" |
*
* @param {Agent_Tool_Analyze_Image_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_analyze_image_name: ((inputs?: Agent_Tool_Analyze_Image_NameInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Tool_Analyze_Image_NameInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Tool_Analyze_Image_NameInputs = {};

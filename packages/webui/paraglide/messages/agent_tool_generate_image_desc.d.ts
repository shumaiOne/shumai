/**
* | output |
* | --- |
* | "Allows the agent to generate images from prompts and reference images using configured AI image models." |
*
* @param {Agent_Tool_Generate_Image_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_generate_image_desc: ((inputs?: Agent_Tool_Generate_Image_DescInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Tool_Generate_Image_DescInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Tool_Generate_Image_DescInputs = {};

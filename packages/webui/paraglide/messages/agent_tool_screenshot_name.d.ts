/**
* | output |
* | --- |
* | "Video Frame Extraction" |
*
* @param {Agent_Tool_Screenshot_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_screenshot_name: ((inputs?: Agent_Tool_Screenshot_NameInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Tool_Screenshot_NameInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Tool_Screenshot_NameInputs = {};

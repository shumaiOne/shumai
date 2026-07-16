/**
* | output |
* | --- |
* | "Allows the agent to extract still image frames from video files for analysis." |
*
* @param {Agent_Tool_Screenshot_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_screenshot_desc: ((inputs?: Agent_Tool_Screenshot_DescInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Tool_Screenshot_DescInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Tool_Screenshot_DescInputs = {};

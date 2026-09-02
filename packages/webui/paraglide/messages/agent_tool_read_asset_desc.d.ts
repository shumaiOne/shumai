/**
* | output |
* | --- |
* | "Allows the agent to view and inspect images, video frames, and document pages." |
*
* @param {Agent_Tool_Read_Asset_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_read_asset_desc: ((inputs?: Agent_Tool_Read_Asset_DescInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Tool_Read_Asset_DescInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Tool_Read_Asset_DescInputs = {};

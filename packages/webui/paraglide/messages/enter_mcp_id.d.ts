/**
* | output |
* | --- |
* | "Enter MCP Server ID" |
*
* @param {Enter_Mcp_IdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const enter_mcp_id: ((inputs?: Enter_Mcp_IdInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Enter_Mcp_IdInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Enter_Mcp_IdInputs = {};

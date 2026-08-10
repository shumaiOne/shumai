/**
* | output |
* | --- |
* | "Refresh Tools" |
*
* @param {Mcp_Refresh_ToolsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_refresh_tools: ((inputs?: Mcp_Refresh_ToolsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Refresh_ToolsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Refresh_ToolsInputs = {};

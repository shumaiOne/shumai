/**
* | output |
* | --- |
* | "Select MCP Server" |
*
* @param {Select_Mcp_ServerInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_mcp_server: ((inputs?: Select_Mcp_ServerInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Select_Mcp_ServerInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Select_Mcp_ServerInputs = {};

/**
* | output |
* | --- |
* | "Delete MCP Server" |
*
* @param {Delete_Mcp_ServerInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_mcp_server: ((inputs?: Delete_Mcp_ServerInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Delete_Mcp_ServerInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Delete_Mcp_ServerInputs = {};

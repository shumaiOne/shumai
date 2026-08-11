/**
* | output |
* | --- |
* | "Edit MCP Server" |
*
* @param {Edit_Mcp_ServerInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const edit_mcp_server: ((inputs?: Edit_Mcp_ServerInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Edit_Mcp_ServerInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Edit_Mcp_ServerInputs = {};

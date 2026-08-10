/**
* | output |
* | --- |
* | "Add MCP Server" |
*
* @param {Add_Mcp_ServerInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_mcp_server: ((inputs?: Add_Mcp_ServerInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Add_Mcp_ServerInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Add_Mcp_ServerInputs = {};

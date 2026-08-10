/**
* | output |
* | --- |
* | "No MCP servers configured" |
*
* @param {No_Mcp_Servers_InstalledInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_mcp_servers_installed: ((inputs?: No_Mcp_Servers_InstalledInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Mcp_Servers_InstalledInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Mcp_Servers_InstalledInputs = {};

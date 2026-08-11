/**
* | output |
* | --- |
* | "Configure Model Context Protocol (MCP) servers and tools for your team." |
*
* @param {Mcp_Servers_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_servers_description: ((inputs?: Mcp_Servers_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Servers_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Servers_DescriptionInputs = {};

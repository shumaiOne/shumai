/**
* | output |
* | --- |
* | "This MCP server requires authentication. Connect in Settings → MCP Servers." |
*
* @param {Mcp_Server_Requires_AuthInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_server_requires_auth: ((inputs?: Mcp_Server_Requires_AuthInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Server_Requires_AuthInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Server_Requires_AuthInputs = {};

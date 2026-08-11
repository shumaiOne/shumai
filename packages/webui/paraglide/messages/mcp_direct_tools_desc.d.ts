/**
* | output |
* | --- |
* | "Exposes MCP tools as native agent tools instead of hiding them behind the MCP proxy. This lets the agent see and call selected MCP tools directly, improving ..." |
*
* @param {Mcp_Direct_Tools_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_direct_tools_desc: ((inputs?: Mcp_Direct_Tools_DescInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Direct_Tools_DescInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Direct_Tools_DescInputs = {};

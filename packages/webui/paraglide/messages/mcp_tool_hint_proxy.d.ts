/**
* | output |
* | --- |
* | "Accessed through MCP proxy to keep LLM context small" |
*
* @param {Mcp_Tool_Hint_ProxyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_tool_hint_proxy: ((inputs?: Mcp_Tool_Hint_ProxyInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Tool_Hint_ProxyInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Tool_Hint_ProxyInputs = {};

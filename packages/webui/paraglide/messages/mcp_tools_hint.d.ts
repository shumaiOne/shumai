/**
* | output |
* | --- |
* | "Off: Disabled. Proxy: Tools are accessed through the MCP proxy to keep LLM context small. Direct: Exposes tools directly as native agent tools for key or fre..." |
*
* @param {Mcp_Tools_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_tools_hint: ((inputs?: Mcp_Tools_HintInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Tools_HintInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Tools_HintInputs = {};

/**
* | output |
* | --- |
* | "Configure tools as Off (disabled), Proxy (via MCP proxy), or Direct (native tool)." |
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

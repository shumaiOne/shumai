/**
* | output |
* | --- |
* | "Exposed directly as native agent tools for key capabilities" |
*
* @param {Mcp_Tool_Hint_DirectInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_tool_hint_direct: ((inputs?: Mcp_Tool_Hint_DirectInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Tool_Hint_DirectInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Tool_Hint_DirectInputs = {};

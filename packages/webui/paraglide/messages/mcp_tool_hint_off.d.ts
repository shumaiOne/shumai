/**
* | output |
* | --- |
* | "Disabled" |
*
* @param {Mcp_Tool_Hint_OffInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_tool_hint_off: ((inputs?: Mcp_Tool_Hint_OffInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Tool_Hint_OffInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Tool_Hint_OffInputs = {};

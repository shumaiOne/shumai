/**
* | output |
* | --- |
* | "Disable a tool to exclude it from this server's toolset." |
*
* @param {Mcp_Excluded_Tools_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_excluded_tools_hint: ((inputs?: Mcp_Excluded_Tools_HintInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Excluded_Tools_HintInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Excluded_Tools_HintInputs = {};

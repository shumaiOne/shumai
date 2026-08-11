/**
* | output |
* | --- |
* | "Direct Tools Mode" |
*
* @param {Mcp_Direct_Tools_ModeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_direct_tools_mode: ((inputs?: Mcp_Direct_Tools_ModeInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Direct_Tools_ModeInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Direct_Tools_ModeInputs = {};

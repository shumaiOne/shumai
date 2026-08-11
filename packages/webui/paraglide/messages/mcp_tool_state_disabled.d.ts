/**
* | output |
* | --- |
* | "Off" |
*
* @param {Mcp_Tool_State_DisabledInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_tool_state_disabled: ((inputs?: Mcp_Tool_State_DisabledInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Tool_State_DisabledInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Tool_State_DisabledInputs = {};

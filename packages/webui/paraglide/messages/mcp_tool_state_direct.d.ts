/**
* | output |
* | --- |
* | "Direct" |
*
* @param {Mcp_Tool_State_DirectInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_tool_state_direct: ((inputs?: Mcp_Tool_State_DirectInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Tool_State_DirectInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Tool_State_DirectInputs = {};

/**
* | output |
* | --- |
* | "Server Instructions" |
*
* @param {Mcp_Server_InstructionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_server_instructions: ((inputs?: Mcp_Server_InstructionsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Server_InstructionsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Server_InstructionsInputs = {};

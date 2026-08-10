/**
* | output |
* | --- |
* | "Name and description are auto-detected from the server after connecting." |
*
* @param {Mcp_Server_Auto_DetectedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_server_auto_detected: ((inputs?: Mcp_Server_Auto_DetectedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Server_Auto_DetectedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Server_Auto_DetectedInputs = {};

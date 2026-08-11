/**
* | output |
* | --- |
* | "Connected" |
*
* @param {Mcp_Status_ConnectedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_status_connected: ((inputs?: Mcp_Status_ConnectedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Status_ConnectedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Status_ConnectedInputs = {};

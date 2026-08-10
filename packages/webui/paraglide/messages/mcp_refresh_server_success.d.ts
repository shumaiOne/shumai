/**
* | output |
* | --- |
* | "Server refreshed" |
*
* @param {Mcp_Refresh_Server_SuccessInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_refresh_server_success: ((inputs?: Mcp_Refresh_Server_SuccessInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Refresh_Server_SuccessInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Refresh_Server_SuccessInputs = {};

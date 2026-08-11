/**
* | output |
* | --- |
* | "Failed to authenticate MCP server" |
*
* @param {Mcp_Auth_FailedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_auth_failed: ((inputs?: Mcp_Auth_FailedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Auth_FailedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Auth_FailedInputs = {};

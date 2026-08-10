/**
* | output |
* | --- |
* | "MCP server authenticated successfully" |
*
* @param {Mcp_Auth_SuccessInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_auth_success: ((inputs?: Mcp_Auth_SuccessInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Auth_SuccessInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Auth_SuccessInputs = {};

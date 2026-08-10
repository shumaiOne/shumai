/**
* | output |
* | --- |
* | "Bearer Token" |
*
* @param {Mcp_Auth_BearerInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_auth_bearer: ((inputs?: Mcp_Auth_BearerInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Auth_BearerInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Auth_BearerInputs = {};

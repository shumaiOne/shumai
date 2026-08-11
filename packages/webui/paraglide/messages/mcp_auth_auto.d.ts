/**
* | output |
* | --- |
* | "Auto-Detect (Default)" |
*
* @param {Mcp_Auth_AutoInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_auth_auto: ((inputs?: Mcp_Auth_AutoInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Auth_AutoInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Auth_AutoInputs = {};

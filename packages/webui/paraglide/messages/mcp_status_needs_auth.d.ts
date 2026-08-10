/**
* | output |
* | --- |
* | "Needs Authentication" |
*
* @param {Mcp_Status_Needs_AuthInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_status_needs_auth: ((inputs?: Mcp_Status_Needs_AuthInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Status_Needs_AuthInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Status_Needs_AuthInputs = {};

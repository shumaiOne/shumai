/**
* | output |
* | --- |
* | "Disconnect Auth" |
*
* @param {Mcp_Disconnect_AuthInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_disconnect_auth: ((inputs?: Mcp_Disconnect_AuthInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Disconnect_AuthInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Disconnect_AuthInputs = {};

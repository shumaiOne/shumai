/**
* | output |
* | --- |
* | "Connect Account" |
*
* @param {Mcp_Connect_AuthInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_connect_auth: ((inputs?: Mcp_Connect_AuthInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Connect_AuthInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Connect_AuthInputs = {};

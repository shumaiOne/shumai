/**
* | output |
* | --- |
* | "Bearer Token" |
*
* @param {Mcp_Bearer_TokenInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_bearer_token: ((inputs?: Mcp_Bearer_TokenInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Bearer_TokenInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Bearer_TokenInputs = {};

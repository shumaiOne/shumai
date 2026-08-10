/**
* | output |
* | --- |
* | "Scope" |
*
* @param {Mcp_Oauth_ScopeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_oauth_scope: ((inputs?: Mcp_Oauth_ScopeInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Oauth_ScopeInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Oauth_ScopeInputs = {};

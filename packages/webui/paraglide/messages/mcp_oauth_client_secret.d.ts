/**
* | output |
* | --- |
* | "Client Secret" |
*
* @param {Mcp_Oauth_Client_SecretInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_oauth_client_secret: ((inputs?: Mcp_Oauth_Client_SecretInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Oauth_Client_SecretInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Oauth_Client_SecretInputs = {};

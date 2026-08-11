/**
* | output |
* | --- |
* | "All Proxy" |
*
* @param {Mcp_Bulk_All_ProxyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_bulk_all_proxy: ((inputs?: Mcp_Bulk_All_ProxyInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Bulk_All_ProxyInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Bulk_All_ProxyInputs = {};

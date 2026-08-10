/**
* | output |
* | --- |
* | "Expose each server tool directly in the prompt instead of multiplexing through the proxy tool." |
*
* @param {Mcp_Direct_Tools_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_direct_tools_desc: ((inputs?: Mcp_Direct_Tools_DescInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Direct_Tools_DescInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Direct_Tools_DescInputs = {};

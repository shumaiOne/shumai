/**
* | output |
* | --- |
* | "All Direct" |
*
* @param {Mcp_Bulk_All_DirectInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_bulk_all_direct: ((inputs?: Mcp_Bulk_All_DirectInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mcp_Bulk_All_DirectInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mcp_Bulk_All_DirectInputs = {};

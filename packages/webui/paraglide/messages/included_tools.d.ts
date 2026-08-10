/**
* | output |
* | --- |
* | "Included Tools" |
*
* @param {Included_ToolsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const included_tools: ((inputs?: Included_ToolsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Included_ToolsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Included_ToolsInputs = {};

/**
* | output |
* | --- |
* | "Excluded Tools" |
*
* @param {Excluded_ToolsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const excluded_tools: ((inputs?: Excluded_ToolsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Excluded_ToolsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Excluded_ToolsInputs = {};

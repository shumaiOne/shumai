/**
* | output |
* | --- |
* | "Select Tool" |
*
* @param {Select_ToolInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_tool: ((inputs?: Select_ToolInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Select_ToolInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Select_ToolInputs = {};

/**
* | output |
* | --- |
* | "View Tools" |
*
* @param {View_ToolsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const view_tools: ((inputs?: View_ToolsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<View_ToolsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type View_ToolsInputs = {};

/**
* | output |
* | --- |
* | "Arguments" |
*
* @param {Tool_ArgumentsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const tool_arguments: ((inputs?: Tool_ArgumentsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Tool_ArgumentsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Tool_ArgumentsInputs = {};

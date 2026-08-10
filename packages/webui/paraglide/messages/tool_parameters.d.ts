/**
* | output |
* | --- |
* | "Parameters" |
*
* @param {Tool_ParametersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const tool_parameters: ((inputs?: Tool_ParametersInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Tool_ParametersInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Tool_ParametersInputs = {};

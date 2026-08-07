/**
* | output |
* | --- |
* | "Select template to overwrite" |
*
* @param {Select_Template_To_OverwriteInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_template_to_overwrite: ((inputs?: Select_Template_To_OverwriteInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Select_Template_To_OverwriteInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Select_Template_To_OverwriteInputs = {};

/**
* | output |
* | --- |
* | "Delete Template" |
*
* @param {Delete_TemplateInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_template: ((inputs?: Delete_TemplateInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Delete_TemplateInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Delete_TemplateInputs = {};

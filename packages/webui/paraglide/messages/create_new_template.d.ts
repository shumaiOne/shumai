/**
* | output |
* | --- |
* | "Create New Template" |
*
* @param {Create_New_TemplateInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const create_new_template: ((inputs?: Create_New_TemplateInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Create_New_TemplateInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Create_New_TemplateInputs = {};

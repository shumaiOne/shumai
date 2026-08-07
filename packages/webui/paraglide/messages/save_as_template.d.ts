/**
* | output |
* | --- |
* | "Save as Template..." |
*
* @param {Save_As_TemplateInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const save_as_template: ((inputs?: Save_As_TemplateInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Save_As_TemplateInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Save_As_TemplateInputs = {};

/**
* | output |
* | --- |
* | "Overwrite Existing Template" |
*
* @param {Overwrite_Existing_TemplateInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const overwrite_existing_template: ((inputs?: Overwrite_Existing_TemplateInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Overwrite_Existing_TemplateInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Overwrite_Existing_TemplateInputs = {};

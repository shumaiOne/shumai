/**
* | output |
* | --- |
* | "Load Template" |
*
* @param {Load_TemplateInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const load_template: ((inputs?: Load_TemplateInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Load_TemplateInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Load_TemplateInputs = {};

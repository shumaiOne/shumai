/**
* | output |
* | --- |
* | "Template saved successfully" |
*
* @param {Template_SavedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const template_saved: ((inputs?: Template_SavedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Template_SavedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Template_SavedInputs = {};

/**
* | output |
* | --- |
* | "Template updated successfully" |
*
* @param {Template_UpdatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const template_updated: ((inputs?: Template_UpdatedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Template_UpdatedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Template_UpdatedInputs = {};

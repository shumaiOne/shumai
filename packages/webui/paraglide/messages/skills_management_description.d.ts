/**
* | output |
* | --- |
* | "Extend your chatbot's capabilities with custom skills." |
*
* @param {Skills_Management_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const skills_management_description: ((inputs?: Skills_Management_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Skills_Management_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Skills_Management_DescriptionInputs = {};

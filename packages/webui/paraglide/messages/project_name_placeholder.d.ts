/**
* | output |
* | --- |
* | "e.g. Acme Marketing, Q3 Product Launch..." |
*
* @param {Project_Name_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const project_name_placeholder: ((inputs?: Project_Name_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Project_Name_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Project_Name_PlaceholderInputs = {};

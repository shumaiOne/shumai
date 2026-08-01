/**
* | output |
* | --- |
* | "Project ID" |
*
* @param {Project_IdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const project_id: ((inputs?: Project_IdInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Project_IdInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Project_IdInputs = {};

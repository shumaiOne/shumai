/**
* | output |
* | --- |
* | "All Projects" |
*
* @param {All_ProjectsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const all_projects: ((inputs?: All_ProjectsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<All_ProjectsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type All_ProjectsInputs = {};

/**
* | output |
* | --- |
* | "Current Project" |
*
* @param {Current_Project_LabelInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const current_project_label: ((inputs?: Current_Project_LabelInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Current_Project_LabelInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Current_Project_LabelInputs = {};

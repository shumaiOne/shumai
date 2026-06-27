/**
* | output |
* | --- |
* | "Failed to create project" |
*
* @param {Failed_Create_ProjectInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_create_project: ((inputs?: Failed_Create_ProjectInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_Create_ProjectInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_Create_ProjectInputs = {};

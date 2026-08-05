/**
* | output |
* | --- |
* | "Add to Project" |
*
* @param {Add_To_ProjectInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_to_project: ((inputs?: Add_To_ProjectInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Add_To_ProjectInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Add_To_ProjectInputs = {};

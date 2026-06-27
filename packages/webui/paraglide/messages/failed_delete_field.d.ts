/**
* | output |
* | --- |
* | "Failed to delete field" |
*
* @param {Failed_Delete_FieldInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_delete_field: ((inputs?: Failed_Delete_FieldInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_Delete_FieldInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_Delete_FieldInputs = {};

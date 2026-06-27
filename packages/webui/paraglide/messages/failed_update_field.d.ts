/**
* | output |
* | --- |
* | "Failed to update field" |
*
* @param {Failed_Update_FieldInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_update_field: ((inputs?: Failed_Update_FieldInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_Update_FieldInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_Update_FieldInputs = {};

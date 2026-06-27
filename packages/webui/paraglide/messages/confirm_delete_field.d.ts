/**
* | output |
* | --- |
* | "Are you sure you want to delete this field?" |
*
* @param {Confirm_Delete_FieldInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const confirm_delete_field: ((inputs?: Confirm_Delete_FieldInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Confirm_Delete_FieldInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Confirm_Delete_FieldInputs = {};

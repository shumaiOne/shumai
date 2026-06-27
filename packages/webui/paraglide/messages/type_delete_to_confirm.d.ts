/**
* | output |
* | --- |
* | "Type **delete** to confirm:" |
*
* @param {Type_Delete_To_ConfirmInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const type_delete_to_confirm: ((inputs?: Type_Delete_To_ConfirmInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Type_Delete_To_ConfirmInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Type_Delete_To_ConfirmInputs = {};

/**
* | output |
* | --- |
* | "Manage Fields" |
*
* @param {Manage_FieldsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const manage_fields: ((inputs?: Manage_FieldsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Manage_FieldsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Manage_FieldsInputs = {};

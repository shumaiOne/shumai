/**
* | output |
* | --- |
* | "Custom Fields" |
*
* @param {Custom_FieldsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const custom_fields: ((inputs?: Custom_FieldsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Custom_FieldsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Custom_FieldsInputs = {};

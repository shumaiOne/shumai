/**
* | output |
* | --- |
* | "Created At" |
*
* @param {Field_Created_AtInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const field_created_at: ((inputs?: Field_Created_AtInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Field_Created_AtInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Field_Created_AtInputs = {};

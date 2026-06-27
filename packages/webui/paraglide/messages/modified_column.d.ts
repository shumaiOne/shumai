/**
* | output |
* | --- |
* | "Modified" |
*
* @param {Modified_ColumnInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const modified_column: ((inputs?: Modified_ColumnInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Modified_ColumnInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Modified_ColumnInputs = {};

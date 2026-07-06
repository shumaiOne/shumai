/**
* | output |
* | --- |
* | "MMMM d, yyyy" |
*
* @param {Date_Format_LongInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const date_format_long: ((inputs?: Date_Format_LongInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Date_Format_LongInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Date_Format_LongInputs = {};

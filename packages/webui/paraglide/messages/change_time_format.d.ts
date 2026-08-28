/**
* | output |
* | --- |
* | "Change time format" |
*
* @param {Change_Time_FormatInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const change_time_format: ((inputs?: Change_Time_FormatInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Change_Time_FormatInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Change_Time_FormatInputs = {};

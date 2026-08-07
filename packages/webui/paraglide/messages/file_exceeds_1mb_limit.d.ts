/**
* | output |
* | --- |
* | "File size exceeds the 1MB limit" |
*
* @param {File_Exceeds_1mb_LimitInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const file_exceeds_1mb_limit: ((inputs?: File_Exceeds_1mb_LimitInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<File_Exceeds_1mb_LimitInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type File_Exceeds_1mb_LimitInputs = {};

/**
* | output |
* | --- |
* | "Mark all as read" |
*
* @param {Mark_All_As_ReadInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mark_all_as_read: ((inputs?: Mark_All_As_ReadInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Mark_All_As_ReadInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Mark_All_As_ReadInputs = {};

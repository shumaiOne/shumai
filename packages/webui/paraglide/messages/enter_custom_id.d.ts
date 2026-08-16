/**
* | output |
* | --- |
* | "Enter custom ID" |
*
* @param {Enter_Custom_IdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const enter_custom_id: ((inputs?: Enter_Custom_IdInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Enter_Custom_IdInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Enter_Custom_IdInputs = {};

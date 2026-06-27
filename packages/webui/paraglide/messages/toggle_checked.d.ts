/**
* | output |
* | --- |
* | "Checked" |
*
* @param {Toggle_CheckedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const toggle_checked: ((inputs?: Toggle_CheckedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Toggle_CheckedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Toggle_CheckedInputs = {};

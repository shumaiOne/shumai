/**
* | output |
* | --- |
* | "Clear Custom Key" |
*
* @param {Clear_Custom_KeyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const clear_custom_key: ((inputs?: Clear_Custom_KeyInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Clear_Custom_KeyInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Clear_Custom_KeyInputs = {};

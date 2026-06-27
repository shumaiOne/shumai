/**
* | output |
* | --- |
* | "Enter some text..." |
*
* @param {Enter_Some_TextInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const enter_some_text: ((inputs?: Enter_Some_TextInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Enter_Some_TextInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Enter_Some_TextInputs = {};

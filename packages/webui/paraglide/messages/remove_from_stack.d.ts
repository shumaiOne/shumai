/**
* | output |
* | --- |
* | "Remove from stack" |
*
* @param {Remove_From_StackInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const remove_from_stack: ((inputs?: Remove_From_StackInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Remove_From_StackInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Remove_From_StackInputs = {};

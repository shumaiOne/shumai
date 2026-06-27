/**
* | output |
* | --- |
* | "e.g. My CLI token" |
*
* @param {Token_Name_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const token_name_placeholder: ((inputs?: Token_Name_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Token_Name_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Token_Name_PlaceholderInputs = {};

/**
* | output |
* | --- |
* | "At least 3 characters" |
*
* @param {Password_Min_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const password_min_placeholder: ((inputs?: Password_Min_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Password_Min_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Password_Min_PlaceholderInputs = {};

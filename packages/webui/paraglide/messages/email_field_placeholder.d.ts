/**
* | output |
* | --- |
* | "john@example.com" |
*
* @param {Email_Field_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const email_field_placeholder: ((inputs?: Email_Field_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Email_Field_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Email_Field_PlaceholderInputs = {};

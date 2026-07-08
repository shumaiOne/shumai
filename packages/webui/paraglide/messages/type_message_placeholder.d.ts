/**
* | output |
* | --- |
* | "Type a message..." |
*
* @param {Type_Message_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const type_message_placeholder: ((inputs?: Type_Message_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Type_Message_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Type_Message_PlaceholderInputs = {};

/**
* | output |
* | --- |
* | "Are you sure you want to delete this chat session? This action cannot be undone." |
*
* @param {Delete_Chat_Confirm_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_chat_confirm_description: ((inputs?: Delete_Chat_Confirm_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Delete_Chat_Confirm_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Delete_Chat_Confirm_DescriptionInputs = {};

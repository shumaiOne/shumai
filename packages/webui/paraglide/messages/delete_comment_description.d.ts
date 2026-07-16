/**
* | output |
* | --- |
* | "Are you sure you want to delete this comment? This action cannot be undone." |
*
* @param {Delete_Comment_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_comment_description: ((inputs?: Delete_Comment_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Delete_Comment_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Delete_Comment_DescriptionInputs = {};

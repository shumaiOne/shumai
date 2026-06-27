/**
* | output |
* | --- |
* | "All items in the recently deleted folder will be permanently removed both from the database and from storage. This action cannot be undone." |
*
* @param {Empty_Trash_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const empty_trash_description: ((inputs?: Empty_Trash_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Empty_Trash_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Empty_Trash_DescriptionInputs = {};

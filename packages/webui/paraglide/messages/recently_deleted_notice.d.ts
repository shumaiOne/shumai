/**
* | output |
* | --- |
* | "Items are automatically deleted after 30 days." |
*
* @param {Recently_Deleted_NoticeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const recently_deleted_notice: ((inputs?: Recently_Deleted_NoticeInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Recently_Deleted_NoticeInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Recently_Deleted_NoticeInputs = {};

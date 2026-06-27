/**
* | output |
* | --- |
* | "Failed to rename share link" |
*
* @param {Failed_Rename_Share_LinkInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_rename_share_link: ((inputs?: Failed_Rename_Share_LinkInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_Rename_Share_LinkInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_Rename_Share_LinkInputs = {};

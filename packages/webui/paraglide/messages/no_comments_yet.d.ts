/**
* | output |
* | --- |
* | "No comments yet" |
*
* @param {No_Comments_YetInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_comments_yet: ((inputs?: No_Comments_YetInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Comments_YetInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Comments_YetInputs = {};

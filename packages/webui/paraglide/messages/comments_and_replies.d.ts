/**
* | output |
* | --- |
* | "Comments & Replies" |
*
* @param {Comments_And_RepliesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const comments_and_replies: ((inputs?: Comments_And_RepliesInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Comments_And_RepliesInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Comments_And_RepliesInputs = {};
